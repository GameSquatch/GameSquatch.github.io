---
layout: post
title: 'Building A Virtual Tree In React'
date: 2025-04-26 16:47:01 -0600
categories: react virtual tree
author: Ezekiel Williams
---

My team has been rebuilding our core product to work in the browser using React. In summary, this product is a visual programming tool that aims to make development of back-end processes and web applications simpler. One of the key data models in this tool is a tree view, which behaves much like a file explorer or directory structure would. You can have folders, "files", and folders within folders, recursively. The projects that our users create often times have tens of thousands to hundreds of thousands of objects within these trees, so there's a lot to consider for perforamnce and usability. This post will be an exploration of constructing such a tree.

## Constraints

- Frequent updates to state data shouldn't have negative impacts to these trees.
- Large numbers of items should still feel reasonably smooth to work with (50k - 800k items).

This application streams collaborative events over a websocket connection, and many of those events are updating objects that exist in the many trees that a user could be interacting with at any given time. One tree in particular contains all of the objects that exist in a user's project, so any time an object is updated from an event or the user, it has the potential to impact what the user sees in the tree.

## Reinventing The Wheel

I also wanted to be sure we weren't just trying to reinvent a wheel here, but with this visual component being such a huge part of the functionality of our product, it might make sense to write something completely custom to our needs. It would give us complete control over it, should anything else be added to it in the future, and we would have a couple of good engineers with some domain expertise as well.

I wasn't on the team in its beginnings so the choice to use a 3rd party library was not mine, but I have to be honest: I probably would have made the same decision given the early project time pressure and the complexities of managing such a structure in React. The library chosen is a fantastic library and has been serving us really well: [react-arborist](https://github.com/brimdata/react-arborist). We have also been experimenting with Tanstack Table's "Expanding feature" which allows you to specify that rows of a table have sub-rows.
