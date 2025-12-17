# Swipe Gesture Implementation

## Overview
The StoryReader component supports both horizontal and vertical swipe gestures using Framer Motion's drag functionality.

## Gesture Types

### 1. Horizontal Swipes (Story Navigation)
**Purpose:** Navigate between stories (previous/next)

**Detection:**
- Gesture must be primarily horizontal (`absX > absY`)
- Left swipe (negative x): Go to next story
- Right swipe (positive x): Go to previous story

**Thresholds:**
```typescript
const SWIPE_THRESHOLD = 50; // pixels
const SWIPE_CONFIDENCE_THRESHOLD = 10000; // velocity * distance
```

**Trigger Conditions:**
- Distance-based: `offset.x < -SWIPE_THRESHOLD` (left) or `offset.x > SWIPE_THRESHOLD` (right)
- Velocity-based: `swipe < -SWIPE_CONFIDENCE_THRESHOLD` (left) or `swipe > SWIPE_CONFIDENCE_THRESHOLD` (right)
  where `swipe = absX * velocity.x`

### 2. Vertical Swipe Down (Open Depth View)
**Purpose:** Navigate to depth view of current story

**Detection:**
- Gesture must be primarily vertical (`absY > absX`)
- Only downward swipes are detected (`offset.y > 0`)

**Threshold:**
```typescript
const VERTICAL_SWIPE_THRESHOLD = 80; // pixels (higher to avoid accidental triggers)
```

**Trigger Condition:**
- `absY > absX && offset.y > VERTICAL_SWIPE_THRESHOLD`

**Action:**
- Navigates to `/stories/[slug]/depth`

## Disambiguation Strategy

The gesture handler uses a **winner-takes-all** approach based on the dominant axis:

```typescript
const absX = Math.abs(offset.x);
const absY = Math.abs(offset.y);

// Check vertical first (higher priority for depth view)
if (absY > absX && offset.y > VERTICAL_SWIPE_THRESHOLD) {
  // Handle vertical swipe
  router.push(`/stories/${currentStory.slug}/depth`);
  return;
}

// Then check horizontal
if (absX > absY) {
  // Handle horizontal swipe (story navigation)
}
```

### Why This Works
1. **Clear separation:** Gestures are categorized by dominant axis
2. **No conflicts:** Only one type of gesture can win
3. **Natural feel:** Users naturally swipe more in one direction
4. **Higher threshold for vertical:** 80px vs 50px reduces false positives

## Keyboard Support

In addition to gestures, keyboard navigation is supported:

- `ArrowLeft`: Previous story
- `ArrowRight`: Next story
- `ArrowDown`: Open depth view (NEW)

## Touch Action Configuration

```typescript
drag  // Allow both x and y axis dragging
dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
dragElastic={0.2}
touchAction: 'none'  // Prevent browser default touch behaviors
```

**Why `touchAction: 'none'`?**
- Prevents browser scroll during drag
- Ensures gesture detection works on all devices
- Allows full control over touch interactions

## Device Compatibility

### Touch Devices (Mobile/Tablet)
- Uses native touch events via Framer Motion
- Smooth gesture recognition
- Works with native momentum scrolling

### Trackpad (Laptop)
- Recognizes trackpad swipe gestures
- Same threshold logic applies
- Works with both two-finger swipes and click-drag

### Mouse
- Click and drag to trigger swipe
- Same distance thresholds
- Visual feedback during drag (elastic constraint)

## Edge Cases Handled

### 1. Diagonal Swipes
- Resolved by comparing `absX` vs `absY`
- Dominant axis wins
- Example: 45° swipe favors the larger component

### 2. Small/Accidental Drags
- Thresholds prevent accidental triggers
- Vertical threshold is higher (80px vs 50px)
- Velocity component adds intentionality check

### 3. Boundary Stories
- First story: Right swipe does nothing
- Last story: Left swipe does nothing
- Depth view: Always accessible from any story

### 4. Rapid Gestures
- Animation queue prevents gesture conflicts
- Each gesture completes before next is processed
- `mode="wait"` in AnimatePresence

## Performance Considerations

### Optimizations
1. **useCallback hooks:** Prevent unnecessary re-renders
2. **Early returns:** Exit handler as soon as gesture is identified
3. **No state during drag:** State only updates on dragEnd
4. **Constraint limits:** Prevent excessive drag distances

### Frame Rate
- Framer Motion handles animation at 60fps
- Gesture detection is event-based (not polling)
- No performance impact on story rendering

## Testing Recommendations

### Manual Testing

1. **Horizontal Swipes**
   ```
   - Swipe left → Next story
   - Swipe right → Previous story
   - Try at different speeds
   - Try on first/last story (should not navigate)
   ```

2. **Vertical Swipes**
   ```
   - Swipe down firmly → Depth view opens
   - Small downward drag → Nothing happens (threshold)
   - Swipe up → Nothing happens (only down supported)
   ```

3. **Diagonal Gestures**
   ```
   - Swipe down-left (45°) → Should favor dominant axis
   - Swipe down-right (45°) → Should favor dominant axis
   - Nearly horizontal → Story navigation
   - Nearly vertical → Depth view
   ```

4. **Device Testing**
   ```
   - Mobile (touch)
   - Tablet (touch)
   - Laptop (trackpad)
   - Desktop (mouse drag)
   ```

### Threshold Tuning

Current values are conservative to avoid false positives:

```typescript
SWIPE_THRESHOLD = 50;              // Good for touch and mouse
SWIPE_CONFIDENCE_THRESHOLD = 10000; // Catches fast flicks
VERTICAL_SWIPE_THRESHOLD = 80;      // Higher = more intentional
```

**To adjust:**
- Decrease thresholds: More sensitive, more false positives
- Increase thresholds: Less sensitive, more intentional gestures required

### Debug Tips

Add console logging to understand gesture behavior:

```typescript
const handleDragEnd = (event, info) => {
  console.log({
    offsetX: info.offset.x,
    offsetY: info.offset.y,
    velocityX: info.velocity.x,
    velocityY: info.velocity.y,
    dominant: Math.abs(info.offset.x) > Math.abs(info.offset.y) ? 'horizontal' : 'vertical'
  });
  // ... rest of handler
};
```

## Future Enhancements

1. **Swipe Up for Different Action**
   - Currently unused
   - Could close depth view or show story info

2. **Multi-finger Gestures**
   - Pinch to zoom hero image
   - Two-finger swipe for alternative navigation

3. **Haptic Feedback**
   - Vibration on successful gesture (mobile)
   - Confirmation of action

4. **Visual Hints**
   - Arrow indicators during drag
   - Preview of next story during horizontal swipe
   - Preview of depth view during vertical swipe

5. **Configurable Thresholds**
   - User preferences for gesture sensitivity
   - Adaptive thresholds based on device type

