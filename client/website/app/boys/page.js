import React from 'react';
import { DepartmentHub } from '../../components/department/DepartmentHub';

export const metadata = {
  title: "Boys' Collection | NP Grand",
  description: "Explore boys' backpacks, wallets, belts, and everyday accessories built for school and adventure."
};

export default function BoysPage() {
  return (
    <DepartmentHub
      gender="boys"
      title="Boys' Collection"
      eyebrow="Built For School Days & Everyday Adventures"
      tagline="Backpacks, Wallets, Belts & Accessories Designed For Young Explorers."
      heroImage="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1800&q=85"
    />
  );
}
