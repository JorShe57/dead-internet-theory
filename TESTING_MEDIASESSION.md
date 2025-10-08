# iOS Safari Lock Screen Audio Testing Guide

This document provides comprehensive testing procedures for iOS Safari MediaSession lock screen controls.

## Prerequisites

- iOS device (iPhone/iPad) running iOS 15 or later
- Safari browser (not Chrome or other browsers)
- Dead Internet Theory app deployed and accessible
- Audio files loaded and playable

## Known iOS Safari Behaviors

### iOS-Specific Quirks

1. **User Gesture Requirement**: iOS Safari requires play() calls to originate from a synchronous user gesture. Any async operation loses this context.

2. **Audio Session Management**: iOS maintains an "audio session" that can be lost if:
   - Audio elements are completely stopped (vs paused)
   - Too much time passes between stopping and starting
   - No audio element has "focus"

3. **Lock Screen Metadata**: iOS requires both MediaSession metadata AND position state to properly display controls

4. **Apple Music Widget**: If audio session is lost, iOS shows Apple Music widget instead of app controls

## Test Scenarios

### Test 1: Basic Lock Screen Play/Pause

**Steps:**
1. Open app in Safari
2. Navigate to album page
3. Start playing a track
4. Lock device (power button)
5. Check lock screen shows player controls
6. Press pause on lock screen
7. Press play on lock screen

**Expected:**
- ✅ App name and track info displayed
- ✅ Pause stops playback
- ✅ Play resumes playback
- ✅ No Apple Music widget appears

**Common Issues:**
- If Apple Music appears: audio session was lost
- If nothing happens: MediaSession handlers not registered

---

### Test 2: Previous Track from Lock Screen

**Steps:**
1. Start playing track 2 or higher
2. Lock device
3. Press previous track button on lock screen

**Expected:**
- ✅ Previous track starts playing immediately
- ✅ Lock screen updates with new track info
- ✅ Audio continues without interruption
- ✅ No need to unlock device

**Common Issues:**
- Apple Music appears: audio focus lost during track change
- Track changes but doesn't play: async play() call lost gesture
- Nothing happens: previoustrack handler not registered

---

### Test 3: Next Track from Lock Screen

**Steps:**
1. Start playing any track
2. Lock device
3. Press next track button on lock screen

**Expected:**
- ✅ Next track starts playing immediately
- ✅ Lock screen updates with new track info
- ✅ Audio continues without interruption

---

### Test 4: Track Ends Naturally, Start New Song

**Steps:**
1. Play a track and let it complete naturally
2. Device remains locked
3. Press play on lock screen

**Expected:**
- ✅ Next track in queue starts playing
- ✅ No need to unlock device
- ✅ Lock screen shows new track info

**Common Issues:**
- Requires unlock: audio session ended with track
- Apple Music appears: need to maintain playback state

---

### Test 5: Manual Pause, Resume After Delay

**Steps:**
1. Play a track
2. Lock device
3. Pause from lock screen
4. Wait 30 seconds
5. Press play from lock screen

**Expected:**
- ✅ Playback resumes without unlocking
- ✅ Position continues from where it paused

---

### Test 6: Track Scrubbing (iOS 15+)

**Steps:**
1. Play a track
2. Lock device
3. Scrub timeline on lock screen

**Expected:**
- ✅ Track position updates
- ✅ Playback continues from new position

**Note:** Not all iOS versions support scrubbing. This is optional.

---

### Test 7: Background Tab Behavior

**Steps:**
1. Start playing a track
2. Switch to another Safari tab
3. Return to app tab

**Expected:**
- ✅ Playback continues
- ✅ UI reflects current playback state
- ✅ Lock screen controls remain functional

---

### Test 8: App State Restoration

**Steps:**
1. Start playing a track
2. Lock device
3. Kill Safari from app switcher
4. Reopen app

**Expected:**
- ✅ App restarts cleanly
- ✅ No audio ghost playback
- ✅ Lock screen controls cleared

---

## Debugging Techniques

### Check MediaSession State

In Safari console (on device via remote debugging):

```javascript
// Check if MediaSession is available
console.log('MediaSession:', navigator.mediaSession);

// Check current metadata
console.log('Metadata:', navigator.mediaSession.metadata);

// Check playback state
console.log('State:', navigator.mediaSession.playbackState);

// Check position state (if supported)
try {
  console.log('Has setPositionState:', typeof navigator.mediaSession.setPositionState);
} catch(e) {
  console.log('Position state not supported');
}
```

### Enable Debug Logging

The app includes built-in logging via `mediaSessionLogger`:

```javascript
// In browser console
window.mediaSessionLogger = true;

// Export logs
console.log(window.mediaSessionLogger.export());
```

### Remote Debugging Setup

1. On Mac: Safari > Preferences > Advanced > Show Develop menu
2. On iOS: Settings > Safari > Advanced > Web Inspector (ON)
3. Connect device via USB
4. Mac Safari > Develop > [Your Device] > [Dead Internet Theory]

---

## Common Failure Patterns

### Pattern 1: Apple Music Widget Appears

**Symptom:** Lock screen shows Apple Music instead of app controls

**Cause:** Audio session lost

**Fix Applied:**
- Previous/next handlers now pause (not stop) current audio
- Maintain playback state as "playing" during transitions
- Synchronous play() calls in all handlers

---

### Pattern 2: Controls Visible But Non-Functional

**Symptom:** Lock screen shows controls but nothing happens when pressed

**Cause:** MediaSession handlers not properly registered

**Fix Applied:**
- Handlers registered in useEffect with proper dependencies
- Handlers recreated when callbacks change

---

### Pattern 3: Track Changes But Doesn't Play

**Symptom:** Track info updates but audio doesn't start

**Cause:** play() called asynchronously, lost user gesture

**Fix Applied:**
- Immediate pause on prev/next to maintain audio focus
- autoplayOnSrcChange triggers play() when new track loads
- Playback state updated to "playing" before async operations

---

## Performance Monitoring

### Metrics to Track

1. **Lock screen action success rate**
   - Play/pause: should be ~100%
   - Prev/next: should be >95%
   
2. **Audio session retention**
   - Measure how often Apple Music widget appears (should be <1%)

3. **User unlock rate**
   - Track how often users must unlock to change tracks

### Analytics Integration

The app logs MediaSession events for debugging. In production, monitor:

```javascript
// Track lock screen usage
mediaSessionLogger.log('previoustrack'); // Logged automatically
mediaSessionLogger.log('nexttrack');     // Logged automatically
```

---

## Rollback Criteria

If any of these occur, consider rollback:

1. Apple Music widget appears >10% of the time
2. Lock screen controls stop working entirely
3. Audio playback breaks in other browsers
4. Increased crash rate on iOS

---

## Success Metrics

After deployment, verify:

- ✅ 0 reports of Apple Music interference
- ✅ Users can navigate full album from lock screen
- ✅ No increase in "unlock device" support requests
- ✅ Positive feedback on lock screen controls

---

## Additional Resources

- [MDN: Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)
- [iOS Safari Quirks](https://webkit.org/blog/6784/new-video-policies-for-ios/)
- [Howler.js iOS Documentation](https://github.com/goldfire/howler.js#mobile-playback)

---

## Support Checklist

When users report lock screen issues:

- [ ] Confirm iOS version (need 14.5+)
- [ ] Confirm using Safari (not Chrome/Firefox)
- [ ] Ask if Apple Music widget appears
- [ ] Check if issue happens on specific tracks
- [ ] Request remote debugging session if possible
- [ ] Export mediaSessionLogger data for analysis
