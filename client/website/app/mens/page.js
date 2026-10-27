import React from 'react';
import { DepartmentHub } from '../../components/department/DepartmentHub';

export const metadata = {
  title: "Men's Collection | NP Grand",
  description: "Explore men's full-grain leather bifold wallets, cardholders, commuter backpacks, and durable belts."
};

export default function MensPage() {
  return (
    <DepartmentHub
      gender="men"
      title="Men's Collection"
      eyebrow="Crafted For Him — AJIO Style"
      tagline="Leather Bifold Wallets, Slim Cardholders, Business Backpacks & Essential Accessories."
      heroImage="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1800&q=85"
    />
  );
}

