import prisma from '../db/client.js';
import type { Area } from '@prisma/client';
import { VALIDATION_LIMITS } from '../bot/utils/validators.js';

/**
 * Areas service handles all area-related database operations.
 */

/**
 * Get all areas for a user, ordered by position.
 */
export async function getUserAreas(userId: string): Promise<Area[]> {
  return prisma.area.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
  });
}

/**
 * Get a single area by ID.
 */
export async function getAreaById(areaId: string): Promise<Area | null> {
  return prisma.area.findUnique({
    where: { id: areaId },
  });
}

/**
 * Get the count of areas for a user.
 */
export async function getUserAreasCount(userId: string): Promise<number> {
  return prisma.area.count({
    where: { userId },
  });
}

/**
 * Check if user can add more areas (max 7).
 */
export async function canAddArea(userId: string): Promise<boolean> {
  const count = await getUserAreasCount(userId);
  return count < VALIDATION_LIMITS.MAX_AREAS_PER_USER;
}

/**
 * Create a new area for a user.
 * Automatically assigns the next position number.
 * Throws an error if the user already has 7 areas.
 */
export async function createArea(
  userId: string,
  data: {
    title: string;
    body?: string;
    emoji?: string;
  }
): Promise<Area> {
  const count = await getUserAreasCount(userId);

  if (count >= VALIDATION_LIMITS.MAX_AREAS_PER_USER) {
    throw new Error(
      `Maximum of ${VALIDATION_LIMITS.MAX_AREAS_PER_USER} areas reached`
    );
  }

  return prisma.area.create({
    data: {
      userId,
      title: data.title,
      body: data.body,
      emoji: data.emoji,
      position: count + 1,
    },
  });
}

/**
 * Update an existing area.
 */
export async function updateArea(
  areaId: string,
  data: {
    title?: string;
    body?: string | null;
    emoji?: string | null;
  }
): Promise<Area> {
  return prisma.area.update({
    where: { id: areaId },
    data: {
      title: data.title,
      body: data.body,
      emoji: data.emoji,
    },
  });
}

/**
 * Delete an area and all its progress entries (cascade).
 * After deletion, reorders remaining areas to maintain sequential positions.
 */
export async function deleteArea(areaId: string): Promise<void> {
  const area = await prisma.area.findUnique({
    where: { id: areaId },
  });

  if (!area) {
    throw new Error('Area not found');
  }

  // Delete the area (progress entries cascade automatically)
  await prisma.area.delete({
    where: { id: areaId },
  });

  // Reorder remaining areas to maintain sequential positions
  const remainingAreas = await prisma.area.findMany({
    where: { userId: area.userId },
    orderBy: { position: 'asc' },
  });

  // Update positions sequentially
  await Promise.all(
    remainingAreas.map((a, index) =>
      prisma.area.update({
        where: { id: a.id },
        data: { position: index + 1 },
      })
    )
  );
}

/**
 * Check if an area belongs to a specific user.
 * Useful for authorization checks.
 */
export async function isAreaOwnedByUser(
  areaId: string,
  userId: string
): Promise<boolean> {
  const area = await prisma.area.findUnique({
    where: { id: areaId },
  });

  return area?.userId === userId;
}
