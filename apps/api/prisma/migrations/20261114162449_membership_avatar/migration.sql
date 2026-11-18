-- CreateEnum
CREATE TYPE "AvatarSkin" AS ENUM ('LIGHT', 'FAIR', 'TAN', 'BROWN', 'DARK');

-- CreateEnum
CREATE TYPE "AvatarHair" AS ENUM ('BALD', 'SHORT', 'CURLY', 'AFRO', 'LONG', 'MOHAWK');

-- CreateEnum
CREATE TYPE "AvatarHairColor" AS ENUM ('BLACK', 'BROWN', 'BLOND', 'RED', 'GRAY');

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "avatarHair" "AvatarHair" NOT NULL DEFAULT 'SHORT',
ADD COLUMN     "avatarHairColor" "AvatarHairColor" NOT NULL DEFAULT 'BLACK',
ADD COLUMN     "avatarSkin" "AvatarSkin" NOT NULL DEFAULT 'TAN';
