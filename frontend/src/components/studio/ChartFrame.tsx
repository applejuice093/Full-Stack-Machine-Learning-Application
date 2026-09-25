import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function ChartFrame({ title, image }: { title: string; image: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    function close() {
      setOpen(false);
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  function exitFullScreen() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setOpen(false);
  }

  return (
    <>
      <figure className="overflow-hidden rounded-xl border border-[#D8D6CF] bg-white">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <figcaption className="text-[11px] font-medium tracking-[0.14em] text-[#85827B] uppercase">
            {title}
          </figcaption>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-8 border border-[#D8D6CF] bg-white px-3 text-xs font-medium text-[#171717] transition-colors duration-150 ease-out hover:bg-[#F1EFE9]"
          >
            Full screen
          </button>
        </div>
        <img
          src={`data:image/png;base64,${image}`}
          alt={title}
          className="mx-auto block h-auto max-h-[calc(100svh-8rem)] w-auto max-w-full object-contain"
        />
      </figure>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50 flex flex-col bg-[#F7F6F2] px-4 py-4 md:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Back"
                  onClick={exitFullScreen}
                  className="inline-flex h-8 w-8 items-center justify-center border border-[#D8D6CF] bg-white text-sm text-[#171717] transition-colors duration-150 ease-out hover:bg-[#F1EFE9]"
                >
                  &lt;
                </button>
                <button
                  type="button"
                  onClick={exitFullScreen}
                  className="h-8 border border-[#D8D6CF] bg-white px-3 text-xs font-medium text-[#171717] transition-colors duration-150 ease-out hover:bg-[#F1EFE9]"
                >
                  Exit full screen
                </button>
                <p className="text-sm font-medium text-[#171717]">{title}</p>
              </div>
              <img
                src={`data:image/png;base64,${image}`}
                alt={title}
                className="mx-auto mt-4 block h-auto max-h-[calc(100svh-5.5rem)] w-auto max-w-full object-contain"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
