---
layout: post
title: 'DRAFT: Building A Virtual Tree In React'
date: 2025-05-06 20:47:00 -0600
categories: react virtual tree
author: Ezekiel Williams
---

My team has been rebuilding our core product to work in the browser using React. In summary, this product is a visual programming tool that aims to make development of back-end processes and web applications simpler. One of the key data models in this tool is a tree view, which behaves much like a file explorer or directory structure would. You can have folders, "files", and folders within folders, recursively. The projects that our users create often times have tens of thousands to hundreds of thousands of objects within these trees, so there's a lot to consider for performance and usability. This post will be an exploration of constructing such a tree.

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
+       {visibleItems.map(({ id, name }, i) => (
+         <div
+           style={{
+             width: '100%',
              height: `${itemHeight}px`,
+             position: 'absolute',
+             transform: `translateY(${(100 + i) * itemHeight}px)`,
+           }}>
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
+ const visibleItems = useMemo(() => items.slice(100, 150), [items]);

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
-             transform: `translateY(${i * itemHeight}px)`,
+             transform: `translateY(${(100 + i) * itemHeight}px)`,
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
              transform: `translateY(${(100 + i) * itemHeight}px)`,
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
              transform: `translateY(${(100 + i) * itemHeight}px)`,
            }}>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

If we know our item height and how far the scroll container has scrolled in pixels, we can calculate the first index that should appear at the top of the scroll container. Think of it like "How many items can fit in the space that I've scrolled down? If that many can fit before the item that's currently at the top of the viewport, then the item at the top must start at the index immediately after that."

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
              transform: `translateY(${(startIndex + i) * itemHeight}px)`,
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
              transform: `translateY(${(startIndex + i) * itemHeight}px)`,
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
              transform: `translateY(${(startIndex + i) * itemHeight}px)`,
            }}>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

And that's it! We have ourselves a very simple virtualized list. It's not the most re-usable thing or the most fully featured, but it definitely helps us understand why virtualized lists require the data to be in a flat list. We can also see that the item height and scrollable container height also play an important role here for a list to be easily virtualized. Luckily for us, a tree list and a normal list should use a constant height for its items (_usually_). Except for the user resizing the window, the parent container should also remain the same height.

If you scroll around quickly in the list currently, you might notice a gap of space starts to appear at the side that is opposite to the direction of scroll. I mentioned earlier in the post that I intentionally did not base the `endIndex` calculation on `startIndex` so we could add buffer items "later". Well now it's later, so let's do that...I guess. And while we're at it, let's handle resizing just because I want to try out the `ResizeObserver` API:

What we want is to widen our "window" of visibility to extend beyond the top and bottom of the scrollable container. This gives items at the edge more time to be rendered as the user scrolls, especially if the items render more expensive things, like images. Some virtualizer libraries call this the "overscan", which I quite like, so let's call it that and make it a prop:

```jsx
function VirtualList({ items, itemHeight, overscan = 0 }) {
  // ...
}
```

The overscan amount is going to modify our start and end index values. When the list is scrolled to the very top, however, we need to make sure we aren't slicing negative values. Similarly, when the list is scrolled to the very bottom, we need to make sure we aren't trying to go beyond the end of original data list. Let's use an example overscan value of 10 to start.

Imagining for a second that our list is scrolled to somewhere in the middle, our new start index would simply be:

```
startIndex = startIndex - overscan;
```

Now we just need to limit the lowest value to be zero:

```
startIndex = startIndex < 0 ? 0 : startIndex;
```

```jsx
function VirtualList({ items, itemHeight, overscan = 0 }) {
  // ...
  let startIndex = Math.floor(scrollTop / itemHeight);
  startIndex = startIndex - overscan;
  startIndex = startIndex < 0 ? 0 : startIndex;
  // ...
}
```

Now when you scroll up, you don't see that weird empty gap start to form. Let's do the same for the `endIndex` now:

```jsx
function VirtualList({ items, itemHeight, overscan = 0 }) {
  // ...
  let endIndex = Math.ceil((scrollTop + viewportHeight) / itemHeight);
  endIndex = endIndex + overscan;
  endIndex = endIndex > items.length ? items.length : endIndex;
  // ...
}
```

Just like that we have a better user experience that can be customized. Let's add in that `ResizeObserver` now:

```jsx
function VirtualList({ items, itemHeight, overscan = 0 }) {
  // ...
  const [viewportHeight, setViewportHeight] = useState(0);
  const viewportRef = useRef(null);
  // ...

  const resizeObserver = useRef(
    new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === viewportRef.current) {
          setViewportHeight(entry.target.clientHeight);
        }
      }
    })
  );

  // ...
  useEffect(() => {
    if (viewportRef.current) {
      resizeObserver.current.observe(viewportRef.current);
    }
  }, []);
  // ...
}
```

Let's make that a custom hook to keep our component a little more clean:

```js
const useOnResizeRef = (ref, onResize) => {
  const resizeObserver = useRef(
    new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === ref.current) {
          onResize(entry.target);
        }
      }
    })
  );

  useEffect(() => {
    if (ref.current) {
      resizeObserver.current.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        resizeObserver.current.unobserve(ref.current);
      }
    };
  }, []);
};
```

```jsx
function VirtualList({ items, itemHeight, overscan = 0 }) {
  // ...
  const [viewportHeight, setViewportHeight] = useState(0);
  const viewportRef = useRef(null);
  // ...

  const onResize = useCallback((resizeTarget) => {
    setViewportHeight(resizeTarget.clientHeight);
  }, []);
  useOnResizeRef(viewportRef, onResize);
  // ...
}
```

## Trees

Now that our virtualized list component is working well enough and adjusts to resizes (unnecessary but good to have), we can start talking about transferring this knowledge to trees. Trees have a very important difference from flat lists, which is that rows in the list can have children, or "sub-rows". At first, the parent row will be in a collapsed state, and the user can click something to expand the row, which will show the children underneath, preferably with indentation to visually indicate their relationship to their parent. What we have learned about virtualized lists thus far tells us that expanding and collapsing is going to change the visibility of of the child rows - expanding makes them visible and collapsing makes them invisible. This means that, in a collapsed state, the child rows (and their children, recursively) will be _removed_ from the DOM. When their parent is expanded, they (and their children, recursively) need to be _added_ to the DOM.

For simplicity's sake, I'm going to keep all of this in the same component. Ideally, you would convert our `VirtualList` component into a "virtualizer" custom hook that gets used in a `Tree` component. The other thing we need to talk about is the shape of our tree data. For simplicity again, I'm going to use two different shapes of tree data; one will be nested and the other will be flat. Here's an example of a nested tree structure:

```js
const nestedTreeData = {
  nodes: [
    {
      id: 'root',
      name: 'Root',
      children: [
        {
          id: 'a',
          name: 'A',
          children: [],
        },
        {
          id: 'b',
          name: 'B',
          children: [
            {
              id: 'c',
              name: 'C',
              children: [],
            },
          ],
        },
      ],
    },
  ],
};
```

Here is an example of a flattened tree structure:

```js
const flattenedTreeData = [
  {
    id: 'root',
    name: 'Root',
    children: ['a', 'b'],
  },
  {
    id: 'a',
    name: 'A',
    children: [],
  },
  {
    id: 'b',
    name: 'B',
    children: ['c'],
  },
  {
    id: 'c',
    name: 'C',
    children: [],
  },
];
```

In the flattened tree structure, the `children` lists actually contain identifiers that are used to locate the actual objects within the tree. To make lookups simpler, we can restructure this into a map:

```js
const flatMapTreeData = {
  root: {
    id: 'root',
    name: 'Root',
    children: ['a', 'b'],
  },
  a: {
    id: 'a',
    name: 'A',
    children: [],
  },
  b: {
    id: 'b',
    name: 'B',
    children: ['c'],
  },
  c: {
    id: 'c',
    name: 'C',
    children: [],
  },
};
// or you can create this if your data exists as a list from the server, for example
const flatMapTreeData = flattenedTreeData.reduce((acc, curr) => {
  acc[curr.id] = curr;
  return acc;
}, {});
```

It doesn't really matter how it's structured, as long as you define how to traverse it. For this post, I'm going to assume the data is in a flat map structure. Here is the starting component:

```jsx
function VirtualTree({ treeData, itemHeight, overscan = 0 }) {
  // ...
}
```

So far it looks exactly the same except `items` is now `treeData`, and there is a new `rootNodeId`. Knowing what we've learned about virtualization, we now have to convert our tree data into a list:

```jsx
function VirtualTree({ treeData, rootNodeId, itemHeight, overscan = 0 }) {
  const items = useMemo(() => {
    const result = [];
    const traverse = (nodeId) => {
      const nodeData = treeData[nodeId];
      result.push(nodeData);
      nodeData.children.forEach((childId) => traverse(childId));
    };
    traverse(rootNodeId);

    return result;
  }, [treeData, rootNodeId]);

  // ...
}
```

The _really_ important thing to notice about this is that the traversal method is depth-first. This ensures that rows will appear in the item list in the correct order. You might be asking "How will the children display themselves in a way that indicates they are nested?", and that would be a great question. For this, I'm just going to augment the original data with a `level` field that will tell us how indented the row needs to be:

```js
const traverse = (nodeId, level = 0) => {
  const nodeData = treeData[nodeId];
  result.push({ ...nodeData, level });
  nodeData.children.forEach((childId) => traverse(childId, level + 1));
};
```

From our existing `VirtualList`, we are going to add a couple of things to the JSX:

```diff
function VirtualTree({ treeData, rootNodeId, itemHeight, overscan = 0 }) {
  // ...
  return (
    <div ref={viewportRef} onScroll={onScroll} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${items.length * itemHeight}px`, position: 'relative' }}>
        {visibleItems.map(({ id, name, level }, i) => (
          <div
            style={{
              width: '100%',
              height: `${itemHeight}px`,
              position: 'absolute',
              transform: `translateY(${(startIndex + i) * itemHeight}px)`,
+             paddingLeft: `${level * 16}px`,
+             display: 'flex'
            }}>
+           <button style={{ marginRight: '8px' }}>+</button>
            <Row name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

This will work but will be extremely ugly. Right now, we have a button that doesn't do anything, but our nodes are rendering like a fully expanding tree. Let's add an expanded nodes state so our button can actually do something:

```jsx
function VirtualTree({ treeData, rootNodeId, itemHeight, overscan = 0 }) {
  const [expandedNodes, setExpandedNodes] = useState({});
  const items = useMemo(() => {
    const result = [];
    const traverse = (nodeId, level = 0) => {
      const nodeData = treeData[nodeId];

      result.push({ ...nodeData, level });
      if (nodeId === rootNodeId || expandedNodes[nodeId]) {
        nodeData.children.forEach((childId) => traverse(childId, level + 1));
      }
    };
    traverse(rootNodeId);

    return result;
  }, [treeData, rootNodeId, expandedNodes]);
}
```

Note how our traversal is using the expanded state to determine if it needs to continue down a given path of the tree. For one, it makes this much more efficient in the most common of scenarios. It's unlikely that the common use-case for the tree is having all nodes expanded all the time. Secondly, isn't it interesting how the whole expanded structure must be traversed any time an expanded or collapsed state changes? This is one of the reasons why virtualization might not be a set it and forget it technique for everyone when it comes to trees. Since I've defaulted the root to being expanded above, this will now render 'root', 'a', and 'b' but not 'c'. So let's add some functionality to our button:

```jsx
  // const onScroll = ...

  const toggleExpanded = useCallback((nodeId) => {
    setExpandedNodes((current) => ({ ...current, [nodeId]: !current[nodeId] }));
  }, []);

  // useEffect...
  {visibleItems.map(({ id, name, level }, i) => (
    {/* ... */}
    <button onClick={() => toggleExpanded(id)} style={{ marginRight: '8px' }}>
      {expandedNodes[id] ? '-' : '+'}
    </button>
    <Row key={id} name={name} />
    {/* ... */}
  ))}
```

Et voila! A working virtual tree. So it's really not all that different from a normal virtual list, but the important thing to know is all that traversal that's happening for expand and collapse functionality. You can actually avoid this by making expanded a local state in the row component. The trade-off is that your tree won't remember the expanded state of lower levels of the tree when you collapse an ancestor, because the row will be unmounted and its expanded state will be reset to its default value.

Here is a full example of the tree we've built so far:

```jsx
export default function VirtualTree({ treeData, rootNodeId, itemHeight, overscan = 0 }) {
  const [expandedNodes, setExpandedNodes] = useState({});
  const items = useMemo(() => {
    const result = [];
    const traverse = (nodeId, level = 0) => {
      const nodeData = treeData[nodeId];

      result.push({ ...nodeData, level });
      if (nodeId === rootNodeId || expandedNodes[nodeId]) {
        nodeData.children.forEach((childId) => traverse(childId, level + 1));
      }
    };
    traverse(rootNodeId);

    return result;
  }, [treeData, rootNodeId, expandedNodes]);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const viewportRef = useRef(null);

  const onResize = useCallback((resizeTarget) => {
    setViewportHeight(resizeTarget.clientHeight);
  }, []);
  useOnResizeRef(viewportRef, onResize);

  let startIndex = Math.floor(scrollTop / itemHeight);
  startIndex = startIndex - overscan;
  startIndex = startIndex < 0 ? 0 : startIndex;
  let endIndex = Math.ceil((scrollTop + viewportHeight) / itemHeight);
  endIndex = endIndex + overscan;
  endIndex = endIndex > items.length - 1 ? items.length : endIndex;

  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  const toggleExpanded = useCallback((nodeId) => {
    setExpandedNodes((state) => ({ ...state, [nodeId]: !state[nodeId] }));
  }, []);

  useEffect(() => {
    if (viewportRef.current) {
      setViewportHeight(viewportRef.current.clientHeight);
    }
  }, []);

  return (
    <div ref={viewportRef} onScroll={onScroll} style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ height: `${items.length * itemHeight}px`, position: 'relative' }}>
        {visibleItems.map(({ id, name, level }, i) => (
          <div
            style={{
              width: '100%',
              height: `${itemHeight}px`,
              position: 'absolute',
              transform: `translateY(${(startIndex + i) * itemHeight}px)`,
              paddingLeft: `${level * 16}px`,
              display: 'flex',
            }}>
            <button onClick={() => toggleExpanded(id)} style={{ marginRight: '8px' }}>
              {expandedNodes[id] ? '-' : '+'}
            </button>
            <Row key={id} name={name} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

And here is a hacky way to get some data into the tree to test scrolling and expanding/collapsing:

```jsx
const treeData = {
  root: {
    id: 'root',
    name: 'Root',
    children: [],
  },
};

const addSubTree = () => {
  const subRoot = crypto.randomUUID();
  const firstChild = crypto.randomUUID();
  const secondChild = crypto.randomUUID();
  const thirdChild = crypto.randomUUID();
  treeData[subRoot] = {
    id: subRoot,
    name: subRoot,
    children: [firstChild],
  };
  treeData[firstChild] = {
    id: firstChild,
    name: firstChild,
    children: [secondChild],
  };
  treeData[secondChild] = {
    id: secondChild,
    name: secondChild,
    children: [thirdChild],
  };
  treeData[thirdChild] = {
    id: thirdChild,
    name: thirdChild,
    children: [],
  };
  treeData.root.children.push(subRoot);
};

for (let i = 0; i < 200; ++i) {
  addSubTree();
}

function App() {
  return <VirtualTree treeData={treeData} rootNodeId="root" itemHeight={30} overscan={15} />;
}
```

## Conclusion

While virtualization is a cool technique, you'll want to figure out if it's right for you. I only showed how collapse and expand triggered re-builds, but there are other things that can necessitate a new virtual list to be rebuilt, like renaming a row when the levels of the tree are sorted by name.

An alternative for tree components is to create a recursive row component, where each row is responsible for rendering its children. The downside is that you can't virtualize it, but if your use-case doesn't have thousands and thousands of rows on-screen at any one time, then you might not actually need virtualization. With recursive row components, only what is expanded will be on-screen and in the DOM, so it kind of acts as a natural virtual technique where the idea of a viewport has changed to be what the user has expanded.

This is only my first post anyways to start getting into writing. Feel free to email me if you have strong opinions or suggestions!
