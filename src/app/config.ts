import { Metadata } from "next";

export const siteConfig = {
  title: "Fashion Marketplace",
  description: "A marketplace for fashion items",
} as const;

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
}; 