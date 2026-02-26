import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { randomUUID } from "crypto";
import { AppDataSource, getRepository } from "../lib/db.js";
import { User } from "../entities/User.js";
import { FriendInvite } from "../entities/FriendInvite.js";
import { Friendship } from "../entities/Friendship.js";
import { Notification } from "../entities/Notification.js";
import { requireAuth } from "../lib/auth.js";
import { inviteFriendSchema } from "../lib/validation.js";
import { sendToUser } from "../ws/handler.js";

async function friendRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", requireAuth);

  fastify.get("/api/friends", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
    const friendships = await getRepository(Friendship).find({
      where: [
        { userAId: request.userId },
        { userBId: request.userId },
      ],
      relations: { userA: true, userB: true },
    });
    const friends = friendships.map((f) =>
      f.userAId === request.userId ? f.userB! : f.userA!
    );
    return reply.send({
      friends: friends.map((u) => ({
        id: u.id,
        username: u.username,
        createdAt: u.createdAt,
      })),
    });
  });

  fastify.get("/api/friends/invites", async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
    const invites = await getRepository(FriendInvite).find({
      where: { toUserId: request.userId!, status: "pending" },
      relations: { fromUser: true },
    });
    return reply.send({
      invites: invites.map((i) => ({
        id: i.id,
        fromUser: i.fromUser ? { id: i.fromUser.id, username: i.fromUser.username } : undefined,
        createdAt: i.createdAt,
      })),
    });
  });

  fastify.post<{ Body: unknown }>(
    "/api/friends/invite",
    async (request: FastifyRequest<{ Body: unknown }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const parsed = inviteFriendSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        const flattened = parsed.error.flatten();
        const firstFieldError =
          Object.values(flattened.fieldErrors).flat().find(Boolean) ?? flattened.formErrors[0];
        const errorMessage =
          typeof firstFieldError === "string" ? firstFieldError : "Validation failed";
        return reply.status(400).send({ error: errorMessage, details: flattened });
      }
      const { username, userId: targetUserId } = parsed.data;
      let toUserId: string;
      if (targetUserId) {
        toUserId = targetUserId;
      } else if (username) {
        const user = await getRepository(User).findOne({ where: { username } });
        if (!user) {
          return reply.status(404).send({ error: "User not found" });
        }
        toUserId = user.id;
      } else {
        return reply.status(400).send({ error: "Provide username or userId" });
      }
      if (toUserId === request.userId) {
        return reply.status(400).send({ error: "Cannot invite yourself" });
      }
      const friendshipRepo = getRepository(Friendship);
      const existingFriendship = await friendshipRepo.findOne({
        where: [
          { userAId: request.userId!, userBId: toUserId },
          { userAId: toUserId, userBId: request.userId! },
        ],
      });
      if (existingFriendship) {
        return reply.status(409).send({ error: "Already friends" });
      }
      const inviteRepo = getRepository(FriendInvite);
      const existingInvite = await inviteRepo.findOne({
        where: { fromUserId: request.userId!, toUserId },
      });
      if (existingInvite) {
        if (existingInvite.status === "pending") {
          return reply.status(409).send({ error: "Invite already sent" });
        }
      }
      let invite: FriendInvite;
      if (existingInvite) {
        existingInvite.status = "pending";
        await inviteRepo.save(existingInvite);
        invite = existingInvite as FriendInvite;
      } else {
        const newInvite = inviteRepo.create({
          id: randomUUID(),
          fromUserId: request.userId!,
          toUserId,
          status: "pending",
          createdAt: new Date(),
        });
        await inviteRepo.save(newInvite);
        invite = newInvite as unknown as FriendInvite;
      }
      const inviteWithUsers = await inviteRepo.findOne({
        where: { id: invite.id },
        relations: { fromUser: true, toUser: true },
      });
      const existingNotification = await getRepository(Notification).findOne({
        where: { userId: toUserId, friendInviteId: invite.id },
      });
      if (!existingNotification) {
        const notif = getRepository(Notification).create({
          id: randomUUID(),
          userId: toUserId,
          type: "friend_invite",
          friendInviteId: invite.id,
          read: false,
        });
        await getRepository(Notification).save(notif);
      }
      const fromUser = inviteWithUsers?.fromUser ?? invite.fromUser;
      sendToUser(toUserId, {
        type: "friend_invite",
        inviteId: invite.id,
        fromUser: fromUser ? { id: fromUser.id, username: fromUser.username } : undefined,
      });
      const toUser = inviteWithUsers?.toUser;
      return reply.status(201).send({
        invite: {
          id: invite.id,
          toUser: toUser ? { id: toUser.id, username: toUser.username } : undefined,
          status: invite.status,
          createdAt: invite.createdAt,
        },
      });
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/friends/invites/:id/accept",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const invite = await getRepository(FriendInvite).findOne({
        where: { id: request.params.id },
      });
      if (!invite || invite.toUserId !== request.userId) {
        return reply.status(404).send({ error: "Invite not found" });
      }
      if (invite.status !== "pending") {
        return reply.status(409).send({ error: "Invite already processed" });
      }
      const [userAId, userBId] = [invite.fromUserId, invite.toUserId].sort();
      await AppDataSource.transaction(async (manager) => {
        await manager.getRepository(FriendInvite).update({ id: invite.id }, { status: "accepted" });
        const friendshipRepo = manager.getRepository(Friendship);
        let friendship = await friendshipRepo.findOne({ where: { userAId, userBId } });
        if (!friendship) {
          friendship = friendshipRepo.create({
            id: randomUUID(),
            userAId,
            userBId,
          });
          await friendshipRepo.save(friendship);
        }
      });
      const friend = await getRepository(User).findOne({
        where: { id: invite.fromUserId },
        select: { id: true, username: true },
      });
      const newFriendForInviter = await getRepository(User).findOne({
        where: { id: invite.toUserId },
        select: { id: true, username: true },
      });
      if (newFriendForInviter) {
        sendToUser(invite.fromUserId, {
          type: "friend_accepted",
          friend: newFriendForInviter,
        });
      }
      return reply.send({ friend: friend ?? undefined });
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/api/friends/invites/:id/reject",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const invite = await getRepository(FriendInvite).findOne({
        where: { id: request.params.id },
      });
      if (!invite || invite.toUserId !== request.userId) {
        return reply.status(404).send({ error: "Invite not found" });
      }
      if (invite.status !== "pending") {
        return reply.status(409).send({ error: "Invite already processed" });
      }
      await getRepository(FriendInvite).update({ id: invite.id }, { status: "rejected" });
      return reply.send({ ok: true });
    }
  );

  fastify.delete<{ Params: { friendId: string } }>(
    "/api/friends/:friendId",
    async (request: FastifyRequest<{ Params: { friendId: string } }>, reply: FastifyReply) => {
      if (!request.userId) return reply.status(401).send({ error: "Unauthorized" });
      const { friendId } = request.params;
      if (friendId === request.userId) {
        return reply.status(400).send({ error: "Cannot remove yourself" });
      }
      const [userAId, userBId] = [request.userId, friendId].sort();
      const friendship = await getRepository(Friendship).findOne({
        where: { userAId, userBId },
      });
      if (!friendship) {
        return reply.status(404).send({ error: "Friendship not found" });
      }
      await getRepository(Friendship).delete({ userAId, userBId });
      sendToUser(request.userId, { type: "friend_removed", friendId });
      sendToUser(friendId, { type: "friend_removed", friendId: request.userId });
      return reply.status(204).send();
    }
  );
}

export default friendRoutes;
