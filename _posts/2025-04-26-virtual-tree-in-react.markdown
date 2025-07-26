---
layout: post
title: 'Building A Virtualized Tree In React'
date: 2025-05-08 20:38:00 -0600
categories: react virtual tree
author: Ezekiel Williams
---

Trees have a very prevalent place in my life at the moment, especially in React. This post will be an exploration of constructing a visual tree component using techniques such as virtualization and tree flattening. I have also created an [example repository](https://github.com/GameSquatch/react-virtual-tree) in Github for anyone who likes to tinker.

## Why?

I'm not pushing anything novel here or trying to convince anyone to use my library. In fact, I don't even have a library. The only purpose of this post is to share what I've learned in hopes that maybe one person might find it helpful. I also enjoy writing, so this doubles as a way to "fill my cup".

## Inspiration

There already exists a few libraries that handle creating and rendering trees for you in React, and they are much more fully-featured than anything I am showing in this post. If you want something with built in accessible keyboard navigation or drag and drop, libraries like [react-arborist](https://www.npmjs.com/package/react-arborist) or [tanstack table](https://tanstack.com/table/latest) work great. Since we are using a library for our trees at work, and because we were noticing some performance issues, I decided to invest some time learning how components like these were built to see if building our own might be a worthwhile effort.

## To Virtualize or Not to Virtualize?

At least in my circle of life and corner of the internet, virtualization seems to be one of those things that people think you can just apply to something without realizing it comes with trade-offs. Admittedly, I was one of those people! This is why I so strongly encourage new developers to try building clone libraries or tools, just so they can wrap their head around the problem space and understand the trade-offs for the benefit they aim to get. I am now going to take my own advice and write down my discoveries in this post.

A high level description of virtualization in a browser application might go like this:
"Basically, it only renders the items that are currently within the "viewport" of a scrollable area, and as the user scrolls, it dynamically creates items coming into view and destroys items going out of view." In React, this might be said slightly differently: "The items currently in the viewport are mounted and as the user scrolls, react will mount items coming into view and unmount the ones going out of view." So how does that actually work though? Here is an example hook in React that would virtualize a list based on a viewport:

{% raw %}

```js
function useVirtualize({ getScrollableElem, itemCount, itemSize }) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const startIndex = Math.floor(scrollTop / itemSize);
  const endIndex = Math.min(Math.ceil((scrollTop + viewportHeight) / itemSize), itemCount);

  const virtualizedItems = useMemo(() => {
    const result = [];
    for (let i = 0; i < endIndex - startIndex; ++i) {
      result.push({
        index: startIndex + i,
        start: (startIndex + i) * itemSize,
        end: (startIndex + i + 1) * itemSize,
        height: itemSize,
      });
    }
    return result;
  }, [startIndex, endIndex, itemSize]);

  useEffect(() => {
    const scrollable = getScrollableElem();
    if (scrollable) {
      scrollable.addEventListener('scroll', onScroll);
    }

    return () => {
      scrollable?.removeEventListener('scroll', onScroll);
    };
  }, [getScrollableElem, onScroll]);

  const onScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  useLayoutEffect(() => {
    const scrollable = getScrollableElem();
    if (scrollable) {
      setViewportHeight(scrollable.clientHeight);
    }
  }, [getScrollableElem]);

  return {
    totalHeight: itemCount * itemSize,
    virtualizedItems,
  };
}
```

Then in a component, you would use it like so:

```jsx
const App = () => {
  const [tableData, setTableData] = useState([]); /// imagine thousands of rows
  const scrollableRef = useRef(null);

  const virtualList = useVirtualize({
    getScrollableElem: () => scrollableRef.current,
    itemCount: tableData.length,
    itemSize: 30,
  });

  return (
    <div ref={scrollableRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: `${virtualList.totalHeight}px`, position: 'relative' }}>
        {virtualList.virtualizedItems.map((virtualItem) => (
          <div
            style={{
              height: '30px',
              position: 'absolute',
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}>
            {tableData[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
};
```

A few important things to notice here:

1. To virtualize, you need the entire list of data available so you can calculate a total size
2. Having a consistent item size helps
3. Any time your data list changes or the viewport changes size, you have to re-virtualize

Not a bad list of constraints for such a beneficial performance improvement. But how does this apply to a tree view then? It should mostly be the same right?

## Trees

Trees have a very important difference from flat lists, which is that rows in the list can have children, or "sub-rows". At first, the parent row will be in a collapsed state, and the user can click something to expand the row, which will show the children underneath, preferably with indentation to visually indicate their relationship to their parent. What we have learned about virtualized lists thus far tells us that expanding and collapsing is going to change the visibility of of the child rows - expanding makes them visible and collapsing makes them invisible. This means that, in a collapsed state, the child rows (and their children, recursively) will be _removed_ from the DOM. When their parent is expanded, they (and their children, recursively) need to be _added_ to the DOM.

Before we look at how our code would need to change to accommodate trees, let's talk about the shape of tree data. For simplicity, I'm only going to talk about two different shapes of tree data; one is nested and the other will be flat. Here's an example of a nested tree structure:

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

In the flattened tree structure, the `children` lists actually contain identifiers that are used to locate the actual objects within the tree. To make lookups simpler and much more efficient, we can restructure this into a map:

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
```

It doesn't really matter how it's structured, as long as you define how to traverse it. Using the flattened map structure, here's what a traversal would look like:

```js
const treeData = {
  /* ... */
};

const traverse = (nodeId) => {
  const nodeData = treeData[nodeId];
  nodeData.children.forEach((childId) => traverse(childId));
};
traverse('root');
```

Ok, that doesn't really _do_ anything though, so since we're talking about virtualization, we need to flatten our tree into a list. Let's add that to the traversal:

```js
const treeData = {
  /* ... */
};

const flattenedTree = [];

const traverse = (nodeId) => {
  const nodeData = treeData[nodeId];
  flattenedTree.push(nodeData);
  nodeData.children.forEach((childId) => traverse(childId));
};
traverse('root');
```

The _really_ important thing to notice about this is that the traversal method is depth-first. This ensures that rows will appear in the item list in the correct order. You might be asking "How will the children display themselves in a way that indicates they are nested?", and that would be a great question. For this, I'm just going to augment the original data with a `level` field that will tell us how deep in the tree the node is:

```js
const traverse = (nodeId, level = 0) => {
  const nodeData = treeData[nodeId];
  flattenedTree.push({ ...nodeData, level });
  nodeData.children.forEach((childId) => traverse(childId, level + 1));
};
traverse('root');
```

Awesome, so now we are producing a list of items in a depth-first order. This is exactly what is needed to pass to a virtualizer, so let's add this into the example component at the beginning of this post:

```jsx
const App = () => {
  const [treeDataMap, setTreeDataMap] = useState({
    /* ... */
  }); /// imagine thousands of nodes
  const scrollableRef = useRef(null);

  // NEW CODE
  const flattenedTree = useMemo(() => {
    const result = [];
    (function traverse(nodeId, level = 0) {
      const nodeData = treeDataMap[nodeId];
      result.push({ ...nodeData, level });
      nodeData.children.forEach((childId) => traverse(childId, level + 1));
    })('root');
    return result;
  }, [treeDataMap]);
  // END NEW CODE

  const virtualList = useVirtualize({
    getScrollableElem: () => scrollableRef.current,
    itemCount: flattenedTree.length,
    itemSize: 30,
  });

  return (
    <div ref={scrollableRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: `${virtualList.totalHeight}px`, position: 'relative' }}>
        {virtualList.virtualizedItems.map((virtualItem) => (
          <div
            style={{
              position: 'absolute',
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
              paddingLeft: `${flattenedTree[virtualItem.index].level * 16}px`,
            }}>
            {flattenedTree[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
};
```

What was once only populating a virtual item list is now that plus a full tree traversal. The somewhat paradoxical thing to note is that the most efficient thing to do would be to traverse only what's visible, but in order to get what's visible we have to flatten the tree first, which requires a full traversal. Now every time your data changes, a full traversal happens before getting virtualized. There are trees that allow rows to expand and collapse, and this can actually help transform our full traversal into a partial traversal by only traversing what is currently expanded. I.e. things that are under collapsed parents won't be visible anyway, so why continue through the tree?

The expanded node state will be a map containing node ids as the keys and a boolean, "is expanded", as the values:

```js
// root is expanded by default
const [expandedNodes, setExpandedNodes] = useState({ root: true });
```

Then we can change our traversal to skip collapsed nodes:

```js
const flattenedTree = useMemo(() => {
  const result = [];
  (function traverse(nodeId, level = 0) {
    const nodeData = treeData[nodeId];
    result.push({ ...nodeData, level });

    // Skipping over non-visible (collapsed) nodes
    if (expandedNodes[nodeId]) {
      nodeData.children.forEach((childId) => traverse(childId, level + 1));
    }
  })('root');
  return result;
}, [treeDataMap, expandedNodes]);
```

We have just saved a bunch of traversal, on average, for large trees! You may be asking, however, didn't `expandedNodes` just become a new dependency in the `useMemo` for tree traversal? Why yes, yes it did. Every time you expand or collapse a node, a traversal will happen. This is the trade-off that is important to understand but isn't really explicitly mentioned in any virtualized tree libraries. If you have a really large tree structure that is mostly expanded all the time, you just went from O(n) to O(m), where n was, depending on the size of your viewport, up to 50 items, and m is now the number of _visible_ nodes in your tree structure, which could be thousands. The unfortunate part about this is that there really isn't any way to avoid this, because expanding and collapsing affects the total number of items to be virtualized. This means you have to reevaluate your tree in _some fashion_ to give the virtualizer a new total count of items. The other consideration here is that the order of nodes in your list is also important, so you can't just update the count when you expand or collapse. The list of nodes being accessed by the virtualized indices need to be in the correct order according to the relationships in your tree. This is why traversing the full visible tree is necessary for expanding and collapsing. There may be ways to optimize this by splicing the items into the list, but this is certainly the most straight forward way to do it.

One way to optimize for this approach is through the use of recursive components. As an example:

```jsx
const TreeNode = ({ nodeData, level }) => {
  const expandedNodes = useContext(ExpandedNodesContext);
  const isExpanded = expandedNodes[nodeId];

  return (
    <>
      <div style={{ paddingLeft: `${level * 16}px` }}>{nodeData.name}</div>
      {isExpanded && nodeData.children.map((childId) => <TreeNode nodeData={treeData[childId]} level={level + 1} />)}
    </>
  );
};
```

The neat thing with this is that each node is responsible for rendering its own children, so you get some benefit of virtualization from the fact that nodes won't render if their parent is collapsed. However, if your tree is mostly expanded for most of the time, you don't see any real benefit here. The other thing to notice is how changing tree data or expanded state would impact performance. At first glance you might think it looks like it won't have an issue from the lack of any looping, but that would be wrong. While _we_, the developers, are not doing the looping, when the context state changes, every single node that is currently rendered and subscribed to that context will receive an update to re-run and get reevaluated for rendering. If you have thousands of visible nodes on screen, this can take a half-second or more to process.

We do have a trick up our sleeve for this one though. Instead of using context for expanded state, we can augment the tree data with an expanded state and pass that down into props as the components render themselves. This way, your tree will remember the expanded state of any level down the tree, even if a parent high above has been collapsed. But wait!! Isn't tree data a state? Yes it is. Updating the expanded state of any node would update the whole tree component. This is where you could use state management libraries like Jotai or Valtio to help make those updates more granular.

{% endraw %}

## Conclusion

While virtualization is a cool technique, you'll want to figure out if it's right for you. I only showed how collapse and expand triggered rerenders, but there are other things that can necessitate a new virtual list to be rebuilt, like renaming a node when the levels of the tree are sorted by name.

An alternative for tree components is to create a recursive row component, where each row is responsible for rendering its children. The downside is that you can't virtualize it, but if your use-case doesn't have thousands and thousands of rows on-screen at any one time, then you might not actually need virtualization. With recursive row components, only what is expanded will be on-screen and in the DOM, so it kind of acts as a natural virtualization technique where the idea of a viewport has changed to be what the user has expanded.

This is only my first post to start getting into writing. Feel free to email me if you have strong opinions or suggestions!

{% include test_script.html %}
