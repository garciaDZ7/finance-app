-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "installment_number" INTEGER,
ADD COLUMN     "installment_plan_id" UUID;

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" UUID NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "installment_count" INTEGER NOT NULL,
    "first_occurred_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "responsible_user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "installment_plans_responsible_user_id_idx" ON "installment_plans"("responsible_user_id");

-- CreateIndex
CREATE INDEX "installment_plans_category_id_idx" ON "installment_plans"("category_id");

-- CreateIndex
CREATE INDEX "installment_plans_first_occurred_at_idx" ON "installment_plans"("first_occurred_at");

-- CreateIndex
CREATE INDEX "transactions_installment_plan_id_idx" ON "transactions"("installment_plan_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_installment_plan_id_fkey" FOREIGN KEY ("installment_plan_id") REFERENCES "installment_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
