import React from 'react';
import { DepartmentHub } from '../../components/department/DepartmentHub';

export const metadata = {
  title: "Women's Collection | NP Grand",
  description: "Explore handcrafted luxury handbags, shoulder totes, slim bags, evening clutches, and leather purses for women."
};

export default function WomensPage() {
  return (
    <DepartmentHub
      gender="women"
      title="Women's Collection"
      eyebrow="Curated For Her — AJIO Style"
      tagline="Handbags, Totes, Slim Shoulder Bags, Clutches, Purses & Elegant Everyday Carry."
      heroImage="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=85"
    />
  );
}

