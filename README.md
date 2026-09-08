# Zihao Fu Site

Personal site built with Astro.

## Local Development

Install dependencies:

```bash
yarn install
```

Start the dev server:

```bash
yarn dev
```

Build the site:

```bash
yarn build
```

Run Astro checks:

```bash
yarn run check
```

## Project Structure

`src/pages/`

- Route files for the site.
- `index.astro` is the homepage.
- `blog/` contains blog listing, pagination, and single-post routes.
- `about.astro`, `archive.astro`, and `resume.astro` are standalone pages.

`src/content/`

- Markdown content collections.
- `posts/` contains blog posts.
- `about/` contains the about page content.
- `authors/` contains author metadata.

`src/content.config.ts`

- Defines Astro content collections and frontmatter schema.

`src/config/`

- Site-level configuration.
- `config.json` stores metadata, favicon path, and general site settings.
- `menu.json` stores navbar and footer links.
- `social.json` stores social profile links.

`src/layouts/`

- Shared page layout and partials.
- `Base.astro` wraps most pages.
- `partials/` contains header and footer.
- `components/` contains reusable UI pieces used by pages and layouts.

`src/lib/`

- Utility code for content parsing, sorting, and markdown behavior.
- `remarkTocHeadings.mjs` handles custom heading ids like `{#section}` and TOC insertion.

`public/`

- Static assets copied as-is at build time.
- `public/assets/` stores site images, CSS, JS, favicons, and resume files.
- Do not put generated route HTML here.

## Writing a New Blog Post

1. Create a new Markdown file in `src/content/posts/`.
   File names become post slugs.

2. Add frontmatter.

```md
---
title: My New Post
description: Short summary for cards and metadata.
date: 2026-03-29
image: /assets/path-to-cover-image.jpg
categories:
  - general
authors:
  - Zihao Fu
tags:
  - notes
draft: false
---
```

3. Write the post body in Markdown below the frontmatter.

4. Put any images or downloadable files for the post under `public/assets/`.
   Example:

```text
public/assets/2026-03-29-resources/
```

5. Reference those assets with site-root paths in Markdown.

```md
![Caption](/assets/2026-03-29-resources/example.jpg)
```

## Photo Galleries

Use the shared photo wall in any Markdown post. No per-post CSS or additional
frontmatter is needed; the styles live in `src/styles/photo-gallery.css`.

```md
<section class="photo-group">

### A place or a project

<div class="photo-wall">
  <a class="photo-tile" href="/assets/example/first.webp"><img src="/assets/example/first.webp" alt="Describe the first view" width="1600" height="1000" loading="lazy" decoding="async" /></a>
  <a class="photo-tile" href="/assets/example/second.webp"><img src="/assets/example/second.webp" alt="Describe the second view" width="1600" height="1000" loading="lazy" decoding="async" /></a>
</div>

Write a caption or paragraph here.

</section>
```

Keep the blank lines around Markdown headings and paragraphs inside the HTML
section so they render as Markdown and headings appear in the TOC. Use each
image's actual pixel dimensions to reserve space while it loads. Photos retain
their original proportions, flow down each column, and link to the full-size
file. Walls collapse to one column on narrow screens; a single photo uses the
full width. Start a new wall for each related set of photos.

For a more varied wall of similarly shaped images, use two explicit columns:

```html
<div class="photo-wall photo-wall--varied">
  <div class="photo-columns">
    <div class="photo-column">
      <!-- First half of the photo-tile links -->
    </div>
    <div class="photo-column">
      <!-- Remaining photo-tile links -->
    </div>
  </div>
</div>
```

On wider walls, the first column is wider and the second starts slightly lower.
Each column flows independently, creating different image sizes and staggered
edges while preserving every photo's original proportions and complete frame.
Split the photos into two roughly balanced groups, in reading order (down the
first column, then the second). Narrow walls stack the groups into one column.
Both variants use static HTML and CSS: no gallery JavaScript, runtime
randomization, cropping, or extra image requests. Actual image dimensions reserve
space before lazy-loaded images arrive. The Minecraft Scenery section is a
complete example.

For video, use a `<div class="photo-tile">` containing a `<video>` with
`controls playsinline preload="none"`, a poster, and its actual width and height.
The Netherlands and September 8 Minecraft posts are complete examples.

## Headings And TOC

Custom heading ids are supported:

```md
## My Section {#my-section}
```

The `{#my-section}` part is hidden in rendering and becomes the heading id.

TOC insertion is supported with one of these markers:

```md
[toc]
```

```md
[[toc]]
```

You can also use a `Table of Contents` heading as the insertion point.

## Notes

- `public/` is for static assets only.
- Route output belongs in `dist/`, not `public/`.
- Content should live in `src/content/` whenever possible so Astro generates pages from source.
