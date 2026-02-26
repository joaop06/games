import type { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveUserEmail1730020800000 implements MigrationInterface {
  name = "RemoveUserEmail1730020800000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "User" DROP COLUMN "email"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "User" ADD "email" character varying NOT NULL UNIQUE`
    );
  }
}
