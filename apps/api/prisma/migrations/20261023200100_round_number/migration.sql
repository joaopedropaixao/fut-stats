-- Número da rodada no grupo ("RODADA 12"), preenchido pelo banco em todo insert.
ALTER TABLE "Round" ADD COLUMN "number" INTEGER NOT NULL DEFAULT 0;

-- Rodadas que já existem: numeradas pela data, por grupo.
UPDATE "Round" AS r
SET "number" = n.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "groupId" ORDER BY "scheduledAt", "createdAt") AS rn
  FROM "Round"
) AS n
WHERE r."id" = n."id";

CREATE UNIQUE INDEX "Round_groupId_number_key" ON "Round"("groupId", "number");

-- Todo insert ganha o maior número do grupo + 1. O lock por grupo (até o fim da transação)
-- impede que duas rodadas criadas ao mesmo tempo peguem o mesmo número.
CREATE FUNCTION "round_assign_number"() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('round_number:' || NEW."groupId"));
  SELECT COALESCE(MAX("number"), 0) + 1 INTO NEW."number" FROM "Round" WHERE "groupId" = NEW."groupId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "round_assign_number"
BEFORE INSERT ON "Round"
FOR EACH ROW EXECUTE FUNCTION "round_assign_number"();
