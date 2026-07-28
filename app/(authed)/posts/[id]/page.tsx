"use client";

import { useParams } from "next/navigation";
import { PostForm } from "@/components/posts/PostForm";
import { useStore } from "@/lib/store";

export default function EditPostPage() {
  const params = useParams<{ id: string }>();
  const { getPostById } = useStore();
  const post = getPostById(params.id);

  if (!post) {
    return <p className="text-center text-sm text-muted-foreground">Post not found.</p>;
  }

  return <PostForm post={post} />;
}
