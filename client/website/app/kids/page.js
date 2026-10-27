import React from 'react';
import { DepartmentHub } from '../../components/department/DepartmentHub';

export const metadata = {
  title: "Kids' Collection | NP Grand",
  description: "Explore children's ergonomic school backpacks, lunch totes, coin pouches, and fun accessories."
};

export default function KidsPage() {
  return (
    <DepartmentHub
      gender="kids"
      title="Kids' Collection"
      eyebrow="Designed For Little Explorers — AJIO Style"
      tagline="School Backpacks, Mini Lunch Bags, Colorful Coin Pouches & Everyday Charms."
      heroImage="https://images.unsplash.com/photo-1576053139778-7e32f2ae3cfd?auto=format&fit=crop&w=1800&q=85"
    />
  );
}

