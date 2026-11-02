import React from 'react';
import { DepartmentHub } from '../../components/department/DepartmentHub';

export const metadata = {
  title: "Girls' Collection | NP Grand",
  description: "Discover girls' handbags, pouches, charms, and colorful accessories for every day."
};

export default function GirlsPage() {
  return (
    <DepartmentHub
      gender="girls"
      title="Girls' Collection"
      eyebrow="Playful Styles For Every Day"
      tagline="Handbags, Pouches, Charms & Accessories Made For Young Fashionistas."
      heroImage="https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1800&q=85"
    />
  );
}
