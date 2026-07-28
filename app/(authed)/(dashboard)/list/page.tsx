import { redirect } from "next/navigation";

// List is no longer a separate route — it's a display-mode toggle on /board
// (see the Settings menu), kept here only so old links/bookmarks still land
// somewhere sensible instead of 404ing.
export default function ListPage() {
  redirect("/board");
}
