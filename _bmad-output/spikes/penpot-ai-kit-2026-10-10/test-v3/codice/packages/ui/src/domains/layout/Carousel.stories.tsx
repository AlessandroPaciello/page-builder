// @generated — DO NOT EDIT BY HAND. (spike v3, sezione)
import type { Meta, StoryObj } from "@storybook/react";

import { ShopCard } from "../commerce/ShopCard";
import { Carousel } from "./Carousel";

const meta = { component: Carousel, title: "Layout/Carousel" } satisfies Meta<typeof Carousel>;
export default meta;

const content = {"autoplay":false,"interval":5,"label":"Prodotti in evidenza"};

const slides = [
  <ShopCard key="slide-1-0" {...{"href":"/prodotti/esempio-1","imageAlt":"Foto del prodotto","heading":"Nome prodotto","category":"Scarpe","description":"Descrizione breve del prodotto.","price":"€ 49,90","ctaLabel":"Vedi prodotto"}} />,
  <ShopCard key="slide-2-1" {...{"href":"/prodotti/esempio-2","imageAlt":"Foto del prodotto","heading":"Nome prodotto","category":"Scarpe","description":"Descrizione breve del prodotto.","price":"€ 49,90","ctaLabel":"Vedi prodotto"}} />,
  <ShopCard key="slide-3-2" {...{"href":"/prodotti/esempio-3","imageAlt":"Foto del prodotto","heading":"Nome prodotto","category":"Scarpe","description":"Descrizione breve del prodotto.","price":"€ 49,90","ctaLabel":"Vedi prodotto"}} />,
  <ShopCard key="slide-1-3" {...{"href":"/prodotti/esempio-1","imageAlt":"Foto del prodotto","heading":"Nome prodotto","category":"Scarpe","description":"Descrizione breve del prodotto.","price":"€ 49,90","ctaLabel":"Vedi prodotto"}} />,
  <ShopCard key="slide-2-4" {...{"href":"/prodotti/esempio-2","imageAlt":"Foto del prodotto","heading":"Nome prodotto","category":"Scarpe","description":"Descrizione breve del prodotto.","price":"€ 49,90","ctaLabel":"Vedi prodotto"}} />,
  <ShopCard key="slide-3-5" {...{"href":"/prodotti/esempio-3","imageAlt":"Foto del prodotto","heading":"Nome prodotto","category":"Scarpe","description":"Descrizione breve del prodotto.","price":"€ 49,90","ctaLabel":"Vedi prodotto"}} />,
];

export const PerView1: StoryObj<typeof Carousel> = { args: { ...content, perView: "1", children: slides } };
export const PerView2: StoryObj<typeof Carousel> = { args: { ...content, perView: "2", children: slides } };
export const PerView3: StoryObj<typeof Carousel> = { args: { ...content, perView: "3", children: slides } };
