import { revalidatePath } from "next/cache";

/** Invalidate every page under a workspace. Cheap and simple for a small team. */
export function revalidateWorkspace(slug: string) {
  revalidatePath(`/w/${slug}`, "layout");
}
