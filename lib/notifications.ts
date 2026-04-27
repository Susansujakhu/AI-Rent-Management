import { prisma } from "./prisma";

export async function createNotification(
  userId: string,
  type:   string,
  title:  string,
  body:   string,
  data?:  Record<string, unknown>,
) {
  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      data: data ? JSON.stringify(data) : null,
    },
  });
}
