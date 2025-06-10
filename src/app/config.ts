import { Metadata } from "next";

export const siteConfig = {
  title: "Online Marketplace",
  description: "A marketplace for a variety of products",
} as const;

export const metadata: Metadata = {
  title: siteConfig.title,
  description: siteConfig.description,
}; 