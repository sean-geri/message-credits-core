import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1792689368670 implements MigrationInterface {
    name = 'InitialSchema1792689368670'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."orders_status_enum" AS ENUM('active', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customer_id" uuid NOT NULL, "credits" integer NOT NULL, "status" "public"."orders_status_enum" NOT NULL DEFAULT 'active', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "cancelled_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "CHK_1f8849aba57c98d25c0c98e1ea" CHECK ("credits" > 0), CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_772d0ce0473ac2ccfa26060dbe" ON "orders" ("customer_id") `);
        await queryRunner.query(`CREATE TABLE "customers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_133ec679a801fab5e070f73d3ea" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "recipients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaign_id" uuid NOT NULL, "phone" text NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_recipients_campaign_phone" UNIQUE ("campaign_id", "phone"), CONSTRAINT "PK_de8fc5a9c364568f294798fe1e9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."campaigns_status_enum" AS ENUM('draft', 'scheduled', 'sent', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "campaigns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "customer_id" uuid NOT NULL, "name" text NOT NULL, "body" text NOT NULL, "status" "public"."campaigns_status_enum" NOT NULL DEFAULT 'draft', "scheduled_at" TIMESTAMP WITH TIME ZONE, "sent_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_0aa635279a1d9fcebdf059e93b" CHECK ("status" <> 'scheduled' OR "scheduled_at" IS NOT NULL), CONSTRAINT "PK_831e3fcd4fc45b4e4c3f57a9ee4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_333be941653b6ab68ce1b93168" ON "campaigns" ("customer_id") `);
        await queryRunner.query(`CREATE INDEX "idx_campaigns_due" ON "campaigns" ("status", "scheduled_at") `);
        await queryRunner.query(`CREATE TYPE "public"."messages_status_enum" AS ENUM('pending', 'accepted', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaign_id" uuid NOT NULL, "recipient_id" uuid NOT NULL, "status" "public"."messages_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "resolved_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "uq_messages_campaign_recipient" UNIQUE ("campaign_id", "recipient_id"), CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_messages_campaign_status" ON "messages" ("campaign_id", "status") `);
        await queryRunner.query(`CREATE TYPE "public"."dispatch_outcome" AS ENUM('accepted', 'rejected')`);
        await queryRunner.query(`CREATE TABLE "dispatch_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "message_id" uuid NOT NULL, "result" "public"."dispatch_outcome" NOT NULL, "reported_at" TIMESTAMP WITH TIME ZONE NOT NULL, "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c8bc858bb09080ca57e4093db4b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7a154179be82470bba1fb9b560" ON "dispatch_results" ("message_id") `);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recipients" ADD CONSTRAINT "FK_0776cae7bc374f5b2369f7ac50c" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "campaigns" ADD CONSTRAINT "FK_333be941653b6ab68ce1b931685" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_7ee9933e7f3d3f6c5a4cfeb154b" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_566c3d68184e83d4307b86f85ab" FOREIGN KEY ("recipient_id") REFERENCES "recipients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dispatch_results" ADD CONSTRAINT "FK_7a154179be82470bba1fb9b5604" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dispatch_results" DROP CONSTRAINT "FK_7a154179be82470bba1fb9b5604"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_566c3d68184e83d4307b86f85ab"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_7ee9933e7f3d3f6c5a4cfeb154b"`);
        await queryRunner.query(`ALTER TABLE "campaigns" DROP CONSTRAINT "FK_333be941653b6ab68ce1b931685"`);
        await queryRunner.query(`ALTER TABLE "recipients" DROP CONSTRAINT "FK_0776cae7bc374f5b2369f7ac50c"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_772d0ce0473ac2ccfa26060dbe9"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7a154179be82470bba1fb9b560"`);
        await queryRunner.query(`DROP TABLE "dispatch_results"`);
        await queryRunner.query(`DROP TYPE "public"."dispatch_outcome"`);
        await queryRunner.query(`DROP INDEX "public"."idx_messages_campaign_status"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TYPE "public"."messages_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."idx_campaigns_due"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_333be941653b6ab68ce1b93168"`);
        await queryRunner.query(`DROP TABLE "campaigns"`);
        await queryRunner.query(`DROP TYPE "public"."campaigns_status_enum"`);
        await queryRunner.query(`DROP TABLE "recipients"`);
        await queryRunner.query(`DROP TABLE "customers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_772d0ce0473ac2ccfa26060dbe"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TYPE "public"."orders_status_enum"`);
    }

}
