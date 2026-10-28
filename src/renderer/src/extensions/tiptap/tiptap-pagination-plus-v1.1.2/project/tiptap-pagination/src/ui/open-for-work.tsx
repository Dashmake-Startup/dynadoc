import { Button } from "./button";

export const OpenForWork = () => {
  return (
    <div
      className="fixed bottom-0 border rounded-lg shadow-sm shadow-amber-400 p-2 bg-muted/90 backdrop-blur-md z-50 mb-4"
      style={{
        right: "50vw",
        marginLeft: "auto",
        alignSelf: "center",
        transform: "translateX(50%)",
      }}
    >
      <div className="flex flex-row items-center justify-between gap-2">
        <div>
          <h1 className="text-sm">
            {" "}
            I'm <span className="font-bold">Open for Work</span>
          </h1>
          <p className="text-xs">Let's talk about your project</p>

        </div>
        <a href="https://forms.gle/KGVAhKSUnjFnGaAw8" target="_blank" rel="noopener noreferrer">
          <Button variant="outline" className="!bg-amber-400 text-black hover:text-amber-50 !transition-all duration-150">
            Contact Me
          </Button>
        </a>
      </div>
    </div>
  );
};
