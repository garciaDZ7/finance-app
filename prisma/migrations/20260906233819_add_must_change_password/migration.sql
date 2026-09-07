-- AlterTable
ALTER TABLE "users" ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT true;

-- Existing users already have established passwords.
UPDATE "users" SET "must_change_password" = false;
