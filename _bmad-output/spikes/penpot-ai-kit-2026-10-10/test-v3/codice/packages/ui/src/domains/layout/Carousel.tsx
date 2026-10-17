// Carousel — creato da GC (scaffold) il 2026-10-11. Da qui il file è tuo: GC non lo riscrive.
// L'aspetto sta in Carousel.styles.ts (@generated da Penpot). VC controlla che ogni parte di Penpot abbia il suo data-slot.

import { cn } from "@penpot-ds/ui/lib/utils";
import * as React from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { carouselStyles as s } from "./Carousel.styles";

export type CarouselProps = Omit<React.ComponentProps<"section">, "autoplay" | "interval" | "label" | "perView"> & {
  perView?: "1" | "2" | "3";
  autoplay?: boolean;
  interval?: number;
  label?: string;
};

/** Quante slide si vedono (gap di 1rem tra una e l'altra); sul telefono sempre una, su tablet al massimo due. */
const basis = {
  "1": "basis-full",
  "2": "basis-full md:basis-[calc((100%-1rem)/2)]",
  "3": "basis-full md:basis-[calc((100%-1rem)/2)] lg:basis-[calc((100%-2rem)/3)]",
} as const;

function Carousel({ className, children, perView = "3", autoplay = false, interval = 5, label = "", onKeyDownCapture, ...props }: CarouselProps) {
  const axes = { perView };
  const track = React.useRef<HTMLDivElement>(null);
  const count = React.Children.count(children);
  const [current, setCurrent] = React.useState(0);
  const [edges, setEdges] = React.useState({ prev: false, next: count > 1 });
  const [paused, setPaused] = React.useState(false);

  const items = (): HTMLElement[] => Array.from(track.current?.children ?? []) as HTMLElement[];
  const scrollTo = React.useCallback((index: number) => {
    const el = track.current;
    const item = items()[index];
    if (el && item) el.scrollTo({ left: item.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }, []);
  // Slide corrente e bordi, ricavati dallo scorrimento (frecce, pallini, trascinamento, tastiera).
  const onScroll = React.useCallback(() => {
    const el = track.current;
    if (!el) return;
    let index = 0;
    let best = Infinity;
    items().forEach((item, i) => {
      const distance = Math.abs(item.offsetLeft - el.offsetLeft - el.scrollLeft);
      if (distance < best) [best, index] = [distance, i];
    });
    setCurrent(index);
    setEdges({ prev: el.scrollLeft > 1, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 });
  }, []);
  React.useEffect(onScroll, [onScroll, count, perView]);

  const step = (dir: 1 | -1) => scrollTo(Math.min(Math.max(current + dir, 0), count - 1));

  // Autoplay: in pausa con il mouse sopra, con il focus dentro o con "riduci movimento"; alla fine riparte.
  React.useEffect(() => {
    if (!autoplay || paused || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      const el = track.current;
      const atEnd = el !== null && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      scrollTo(atEnd ? 0 : current + 1);
    }, interval * 1000);
    return () => window.clearInterval(id);
  }, [autoplay, paused, interval, current, count, scrollTo]);

  return (
    <section
      data-slot="carousel"
      aria-roledescription="carousel"
      {...props}
      aria-label={label}
      onKeyDownCapture={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          step(event.key === "ArrowLeft" ? -1 : 1);
        }
        onKeyDownCapture?.(event);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      className={cn(s.root(axes), "focus-visible:outline-2 focus-visible:outline-offset-2", className)}
    >
      <button type="button" data-slot="carousel-previous" disabled={!edges.prev} onClick={() => step(-1)} className={cn(s.previous(axes), "disabled:opacity-50")}>
        <ChevronLeft data-slot="carousel-previous-icon" aria-hidden="true" className={s.previousIcon(axes)} />
        <span className="sr-only">Slide precedente</span>
      </button>
      <div data-slot="carousel-viewport" className={cn(s.viewport(axes), "w-full")}>
        <div
          ref={track}
          onScroll={onScroll}
          data-slot="carousel-slides"
          className={cn(s.slides(axes), "w-full snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none]")}
        >
          {React.Children.map(children, (child, i) => (
            <div
              data-slot="carousel-slides-item"
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} di ${count}`}
              className={cn(s.slidesItem(axes), basis[perView], "snap-start")}
            >
              {child}
            </div>
          ))}
        </div>
      </div>
      <div data-slot="carousel-dots" className={s.dots(axes)}>
        {React.Children.map(children, (_, i) => (
          <button
            type="button"
            data-slot="carousel-dot"
            data-active={i === current || undefined}
            aria-label={`Vai alla slide ${i + 1}`}
            aria-current={i === current || undefined}
            onClick={() => scrollTo(i)}
            className={i === current ? s.dotActive(axes) : s.dot(axes)}
          />
        ))}
      </div>
      <button type="button" data-slot="carousel-next" disabled={!edges.next} onClick={() => step(1)} className={cn(s.next(axes), "disabled:opacity-50")}>
        <ChevronRight data-slot="carousel-next-icon" aria-hidden="true" className={s.nextIcon(axes)} />
        <span className="sr-only">Slide successiva</span>
      </button>
    </section>
  );
}

export { Carousel };
