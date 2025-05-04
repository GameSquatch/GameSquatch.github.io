---
layout: post
title: 'Building A Virtual Tree In React'
date: 2025-04-26 16:47:01 -0600
categories: react virtual tree
author: Ezekiel Williams
---

My team has been rebuilding our core product to work in the browser using React. In summary, this product is a visual programming tool that aims to make development of back-end processes and web applications simpler. One of the key data models in this tool is a tree view, which behaves much like a file explorer or directory structure would. You can have folders, "files", and folders within folders, recursively. The projects that our users create often times have tens of thousands to hundreds of thousands of objects within these trees, so there's a lot to consider for perforamnce and usability. This post will be an exploration of constructing such a tree.

## Why?

I'm not pushing anything novel here or trying to convince anyone to use my library. In fact, I don't even have a library. The only purpose of this post is to share what I've learned in hopes that maybe one person might find it helpful. I also enjoy writing, so this doubles as a way to "fill my cup".

## Inspiration

There already exists a few libraries that handle creating and rendering trees for you in React, and they are much more fully-featured than anything I am showing in this post. If you want something with built in accessible keyboard navigation or drag and drop, libraries like [react-arborist](https://www.npmjs.com/package/react-arborist) or [tanstack table](https://tanstack.com/table/latest) work great. Since we are using a library for our trees, and because we were noticing some performance issues, I decided to invest some time learning how components like these were built to see if building our own might be a worthwhile effort.

## To Virtualize or Not to Virtualize?

At least in my circle of life and corner of the internet, virtualization seems to be one of those things that people think you can just apply to something without realizing it comes with trade-offs. I was one of those people! This is why I so strongly encourage new developers to try building clone libraries or tools, just so they can wrap their head around the problem space and understand what's required to make it work well.

A high level description of virtualization in a browser application might go like this:
"Basically, it only renders the items that are currently within the "viewport" of a scrollable area, and as the user scrolls, it dynamically renders items coming into view and destroys items going out of view."

And that would be accurate! But how does it do that? You wouldn't really know unless you tried to build one. So that's what we're going to do now, so we can understand what the trade-offs are.

Let's start off by building the simple starting components:

```jsx
const Row = memo(({ name }) => {
  return <div>{name}</div>;
});

function VirtualList({ items }) {
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {items.map(({ id, name }) => (
        <div>
          <Row name={name} />
        </div>
      ))}
    </div>
  );
}
```

Not too bad so far. We are simply rendering 5,000 rows that display their name. Right now, we have a single, scrollable container and because the items within extend beyond that container, it scrolls. However, when we eventually remove all but the visible items, the container's scroll bar will not be correct, so we need to add a layer whose height is equal to the total number of items multiplied by the height of a single item.

```diff
-function VirtualList({ items }) {
+function VirtualList({ items, itemHeight }) {
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
+     <div style={{ height: `${items.length * itemHeight}px` }}>
      {items.map(({ id, name }) => (
-        <div>
+        <div style={{ height: `${itemHeight}px` }}>
          <Row name={name} />
        </div>
      ))}
+     </div>
    </div>
  );
}
```

Nothing should have changed functionality-wise at this point, but now we have a really tall box inside our scrollable container. You can imagine our scrollable container as a window. Behind that window sits our really tall box we just created. So at any given point, you're only looking at the items in the tall box that are visible through the window. This is what's going to allow us to remove the out-of-view items from the DOM and still keep the correct scroll height. Here's the full component now, without the diff syntax:

```jsx
function VirtualList({ items, itemHeight }) {
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${items.length * itemHeight}px` }}>
        {items.map(({ id, name }) => (
          <div style={{ height: `${itemHeight}px` }}>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Great, so now what? First, we need to think about what happens to the layout of the items inside the tall box when you remove the out-of-view items. Right now, all the items are being rendered, and the tall container has a default positioning, so the items are being laid out according to relative positioning, which just means they will be correctly positioned within the tall container based on the positions and heights of the boxes as you go from top to bottom. So if the first item is at position 0 with a height of 30, the next item's position will be 30. When all of the out-of-view items are removed everything will just slam to the top of the container and the scroll position will eventually show the user empty space. We don't want that, so we are going to use absolute positioning:

```diff
function VirtualList({ items, itemHeight }) {
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
-     <div style={{ height: `${items.length * itemHeight}px` }}>
-       {items.map(({ id, name }) => (
-         <div style={{ height: `${itemHeight}px` }}>
+     <div style={{ height: `${items.length * itemHeight}px`, position: 'relative' }}>
+       {items.map(({ id, name }, i) => (
+         <div style={{ width: '100%', height: `${itemHeight}px`, position: 'absolute', transform: `translateY(${i * itemHeight})` }}>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

We started by making the tall container have a `relative` position, so that the items would be absolutely positioned relative to it. We then added the `i` argument to the `map()` and used that to translate along the Y. For example, the 4th item (`i` = 3) would be positioned at `3 * 30 => 90` pixels if its height was 30. The row wrapper now has a 100% width, since positioning absolutely shrinks it to its content.

Once again, nothing should behave any differently, but we have prepared ourselves well for the remaining changes. Before we get into a bunch of calculations and scroll event handling, let's just see if we can render only a range of items and have them appear in the location they should be. We're going to take a slice of our item data in order to do this:

```diff
function VirtualList({ items, itemHeight }) {
  const visibleItems = useMemo(() => items.slice(100, 150), [items]);

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${items.length * itemHeight}px`, position: 'relative' }}>
-       {items.map(({ id, name }, i) => (
+       {visibleItems.map(({ id, name }, i) => (
          <div
            style={{
              width: '100%',
              height: `${itemHeight}px`,
              position: 'absolute',
-             transform: `translateY(${i * itemHeight})`,
+             transform: `translateY(${(100 + i) * itemHeight})`,
            }}>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

So we've taken a slice of our items from index 100 to 149 and used that list to map over. There's also a subtle change to the row wrapper div, which is that we changed the `translateY` to use `100 + i` instead of just `i`. This is because the map now only loops over 50 items total and since we sliced our items starting at index 100, that's also where the translation position starts. So now when you run the component, you have mostly empty space except for the rows 101 to 150. Here's the full component now:

```jsx
function VirtualList({ items, itemHeight }) {
  const visibleItems = useMemo(() => items.slice(100, 150), [items]);

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${items.length * itemHeight}px`, position: 'relative' }}>
        {visibleItems.map(({ id, name }, i) => (
          <div
            style={{
              width: '100%',
              height: `${itemHeight}px`,
              position: 'absolute',
              transform: `translateY(${(100 + i) * itemHeight})`,
            }}>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Looking at our definition of `visibleItems`, we know that we want to take a slice using some starting index and some end index. We also know that the starting index needs to be based on how far down the scrollable container is scrolled (i.e. `element.scrollTop`). Knowing those two things, let's start by creating a state for the `scrollTop` value and setting it on scroll events:

```jsx
function VirtualList({ items, itemHeight }) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleItems = useMemo(() => items.slice(100, 150), [items]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return (
    <div onScroll={onScroll} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${items.length * itemHeight}px`, position: 'relative' }}>
        {visibleItems.map(({ id, name }, i) => (
          <div
            style={{
              width: '100%',
              height: `${itemHeight}px`,
              position: 'absolute',
              transform: `translateY(${(100 + i) * itemHeight})`,
            }}>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

If we know our item height and how far the scroll container has scrolled in pixels, we can calculate the first index that should appear at the top of the scroll container. Think of it like "How many items can fit in the space that I've scrolled down? If that many can fit before the item that's currently at the top of the viewport, then the item at the top must start at the index immdediately after that."

```js
const startIndex = scrollTop / itemHeight;
```

And since we want a whole number and the ability to render the top item if it's partially out of view, we'll prefer the rounded _down_ number:

```js
const startIndex = Math.floor(scrollTop / itemHeight);
```

Let's use that in our slice now:

```js
const startIndex = Math.floor(scrollTop / itemHeight);
const visibleItems = useMemo(() => items.slice(startIndex, 150), [items, startIndex]);
```

Don't forget to add it to the translate:

```diff
-transform: `translateY(${(100 + i) * itemHeight})`,
+transform: `translateY(${(startIndex + i) * itemHeight})`,
```

The full thing again:

```jsx
function VirtualList({ items, itemHeight }) {
  const [scrollTop, setScrollTop] = useState(0);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const visibleItems = useMemo(() => items.slice(startIndex, 150), [items, startIndex]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return (
    <div onScroll={onScroll} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${items.length * itemHeight}px`, position: 'relative' }}>
        {visibleItems.map(({ id, name }, i) => (
          <div
            style={{
              width: '100%',
              height: `${itemHeight}px`,
              position: 'absolute',
              transform: `translateY(${(startIndex + i) * itemHeight})`,
            }}>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

And it works! Sort of...

If you run this and inspect the DOM, you'll notice that it starts off with all of the elements from row 1 to 150. However, if you start scrolling, you can see the list start to shrink! That's the slice working as you scroll. Once you scroll past 150 though, it's empty again :/. Now we just have to add an ending index to tell the slice where to stop. So we have a scroll top value but not a scroll bottom. We do have ways to get the height of our viewport though, so we can calculate how many items fit into view at any given time. So let's say our viewport was 500 pixels tall and our items were each 50 pixels tall. That means 10 will fit into view at a time. So if our starting index is 0, and 10 items are in view, that means the last index being rendered is 9.

To put that mathematically:

```js
const endIndex = startIndex + viewportHeight / itemHeight;
```

If we expand startIndex, it looks like this:

```js
const endIndex = scrollTop / itemHeight + viewportHeight / itemHeight;
// which is just
const endIndex = (scrollTop + viewportHeight) / itemHeight;
// and for the same reasons as the startIndex
const endIndex = Math.ceil((scrollTop + viewportHeight) / itemHeight);
```

There's a reason I am showing it this way as opposed to using the `startIndex` value in the calculation of `endIndex`. That's because we are going to add in top and bottom buffer items later, which makes the scrolling look more smooth.

Ok, so how to we get the viewport height? I'm going to do it this way, which might not be the best way, but it would allow this component to evolve in the future by listening for window resizing:

```jsx
function VirtualList({ items, itemHeight }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const viewportRef = useRef(null);

  const startIndex = Math.floor(scrollTop / itemHeight);
  const visibleItems = useMemo(() => items.slice(startIndex, 150), [items, startIndex]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  useEffect(() => {
    if (viewportRef.current) {
      setViewportHeight(viewportRef.current.clientHeight);
    }
  }, []);

  return (
    <div ref={viewportRef} onScroll={onScroll} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${items.length * itemHeight}px`, position: 'relative' }}>
        {visibleItems.map(({ id, name }, i) => (
          <div
            style={{
              width: '100%',
              height: `${itemHeight}px`,
              position: 'absolute',
              transform: `translateY(${(startIndex + i) * itemHeight})`,
            }}>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

Using an element ref, we can just grab the `clientHeight` off of it and set a state value to that. Now we just have to add in our calculation from above into this new code:

```diff
function VirtualList({ items, itemHeight }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const viewportRef = useRef(null);

  const startIndex = Math.floor(scrollTop / itemHeight);
+ const endIndex = Math.ceil((scrollTop + viewportHeight) / itemHeight);

- const visibleItems = useMemo(() => items.slice(startIndex, 150), [items, startIndex]);
+ const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  useEffect(() => {
    if (viewportRef.current) {
      setViewportHeight(viewportRef.current.clientHeight);
    }
  }, []);

  return (
    <div ref={viewportRef} onScroll={onScroll} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${items.length * itemHeight}px`, position: 'relative' }}>
        {visibleItems.map(({ id, name }, i) => (
          <div
            style={{
              width: '100%',
              height: `${itemHeight}px`,
              position: 'absolute',
              transform: `translateY(${(startIndex + i) * itemHeight})`,
            }}>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

And that's it!
