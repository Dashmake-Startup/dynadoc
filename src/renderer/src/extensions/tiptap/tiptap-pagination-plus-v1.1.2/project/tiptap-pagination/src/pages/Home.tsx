import { OpenForWork } from "@/ui/open-for-work";
import TiptapEditor from "@/ui/tiptap-editor";

function Home() {
  return (
    <div className="max-w-4xl mx-auto px-2 relative">
      <TiptapEditor />
      <OpenForWork />
    </div>
  );
}

export default Home;
