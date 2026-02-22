import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1771717830133 implements MigrationInterface {
    name = 'InitialSchema1771717830133'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."chain_enum" AS ENUM('eth', 'sol', 'bnb', 'base', 'arb', 'tron', 'btc')`);
        await queryRunner.query(`CREATE TYPE "public"."wallet_type_enum" AS ENUM('Early Adopter', 'DeFi Degen', 'NFT Trader', 'Long-term Holder', 'Arbitrageur', 'Informação Privilegiada Possível')`);
        await queryRunner.query(`CREATE TYPE "public"."wallet_status_enum" AS ENUM('active', 'observacao', 'desqualificado')`);
        await queryRunner.query(`CREATE TABLE "wallets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "address" character varying(255) NOT NULL, "chain" "public"."chain_enum" NOT NULL, "type" "public"."wallet_type_enum", "currentScore" numeric(20,8), "winRate" numeric(10,6), "roi" numeric(20,8), "totalOperations" integer NOT NULL DEFAULT '0', "firstSeen" TIMESTAMP WITH TIME ZONE NOT NULL, "lastActive" TIMESTAMP WITH TIME ZONE, "status" "public"."wallet_status_enum" NOT NULL DEFAULT 'observacao', "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_wallet_address_chain" UNIQUE ("address", "chain"), CONSTRAINT "PK_8402e5df5a30a229380e83e4f7e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_wallet_status" ON "wallets" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_wallet_chain" ON "wallets" ("chain") `);
        await queryRunner.query(`CREATE TABLE "whale_scores" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "scoreAllTime" numeric(20,8) NOT NULL, "score90d" numeric(20,8) NOT NULL, "winRate" numeric(10,6) NOT NULL, "sharpeRatio" numeric(20,8) NOT NULL, "roiAdjusted" numeric(20,8) NOT NULL, "totalOperations" integer NOT NULL, "calculatedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "wallet_id" uuid NOT NULL, CONSTRAINT "PK_7495a4256b831353958c36666df" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_whale_score_calculated_at" ON "whale_scores" ("calculatedAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_whale_score_wallet_id" ON "whale_scores" ("wallet_id") `);
        await queryRunner.query(`CREATE TYPE "public"."transaction_type_enum" AS ENUM('buy', 'sell')`);
        await queryRunner.query(`CREATE TYPE "public"."transaction_status_enum" AS ENUM('pendente', 'finalizado')`);
        await queryRunner.query(`CREATE TABLE "transactions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "tokenAddress" character varying(255) NOT NULL, "tokenSymbol" character varying(50), "chain" "public"."chain_enum" NOT NULL, "type" "public"."transaction_type_enum" NOT NULL, "amountUsd" numeric(20,8) NOT NULL, "txHash" character varying(255) NOT NULL, "blockNumber" bigint NOT NULL, "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL, "status" "public"."transaction_status_enum" NOT NULL DEFAULT 'pendente', "tokenRiskScore" numeric(10,6), "roiAdjusted" numeric(20,8), "isFinalized" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "wallet_id" uuid NOT NULL, CONSTRAINT "UQ_377e667b39fb231c19804db95d8" UNIQUE ("txHash"), CONSTRAINT "PK_a219afd8dd77ed80f5a862f1db9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_tx_wallet_status_ts" ON "transactions" ("wallet_id", "status", "timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_tx_token_address" ON "transactions" ("tokenAddress") `);
        await queryRunner.query(`CREATE INDEX "IDX_tx_timestamp" ON "transactions" ("timestamp") `);
        await queryRunner.query(`CREATE INDEX "IDX_tx_status" ON "transactions" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_tx_chain" ON "transactions" ("chain") `);
        await queryRunner.query(`CREATE INDEX "IDX_tx_wallet_id" ON "transactions" ("wallet_id") `);
        await queryRunner.query(`CREATE TYPE "public"."alert_type_enum" AS ENUM('whale_movement', 'confluence', 'accumulation', 'reorg_cancel')`);
        await queryRunner.query(`CREATE TABLE "alerts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" "public"."alert_type_enum" NOT NULL, "message" text NOT NULL, "value" numeric(20,8), "isRead" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "wallet_id" uuid NOT NULL, CONSTRAINT "PK_60f895662df096bfcdfab7f4b96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_alert_created_at" ON "alerts" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_alert_is_read" ON "alerts" ("isRead") `);
        await queryRunner.query(`CREATE INDEX "IDX_alert_type" ON "alerts" ("type") `);
        await queryRunner.query(`CREATE INDEX "IDX_alert_wallet_id" ON "alerts" ("wallet_id") `);
        await queryRunner.query(`ALTER TABLE "whale_scores" ADD CONSTRAINT "FK_b52f25fde4bc5c97776036616e4" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_0b171330be0cb621f8d73b87a9e" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "alerts" ADD CONSTRAINT "FK_d5ff47784f5b599351173552f87" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "alerts" DROP CONSTRAINT "FK_d5ff47784f5b599351173552f87"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_0b171330be0cb621f8d73b87a9e"`);
        await queryRunner.query(`ALTER TABLE "whale_scores" DROP CONSTRAINT "FK_b52f25fde4bc5c97776036616e4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_alert_wallet_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_alert_type"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_alert_is_read"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_alert_created_at"`);
        await queryRunner.query(`DROP TABLE "alerts"`);
        await queryRunner.query(`DROP TYPE "public"."alert_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tx_wallet_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tx_chain"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tx_status"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tx_timestamp"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tx_token_address"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tx_wallet_status_ts"`);
        await queryRunner.query(`DROP TABLE "transactions"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transaction_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_whale_score_wallet_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_whale_score_calculated_at"`);
        await queryRunner.query(`DROP TABLE "whale_scores"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_wallet_chain"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_wallet_status"`);
        await queryRunner.query(`DROP TABLE "wallets"`);
        await queryRunner.query(`DROP TYPE "public"."wallet_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."wallet_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."chain_enum"`);
    }

}
