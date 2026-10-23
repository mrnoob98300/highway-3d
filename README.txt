TURN ANIMATION UPDATE
Camera looks along the actual curved road with shorter look-ahead on hairpins,
while preserving a clear view of the player and a level horizon. Heading and
subtle body lean ease into and out of bends. Front wheels turn with both the
road curvature and manual steering. Chase distance remains stable through turns.
Curve preview progressively reduces speed before a tight bend; manual brake
and nitro remain available. Render animation uses the same maximum frame time
as the driving simulation, improving behavior during slower frames.
All ten route hairpins were checked for camera distance, framing and smooth
lean. All ten time-attack missions passed an obstacle-free timing check using
the starter car and initial nitro; traffic and player choices still affect play.

VISUAL / CAMERA UPDATE
Chase distance now stays constant while accelerating and under slow rendering;
the car no longer recedes into the distance as the camera falls behind.
Camera is closer and lower. Outdoor reflections replace garage ceiling-light
reflections while driving. Glass, concrete and terrain have material variation.
Nature and Snow use instanced branching trees with individual textured leaves
and near/far detail, replacing simple cone foliage. Rear aero panels use a dark
composite finish. Atlantic Hypercar is the new featured starter; other cars and
saved progress remain. The speed and nitro display is compact and centered,
with amber-accented controls and a clearer road view.

HIGHWAY RUSH 3D — DRIVERS EDITION

INSTALL / GITHUB PAGES
Extract this ZIP. Replace the existing game files in your repository with ALL
files and folders inside it. index.html belongs at the repository root.
Keep maps/, media/, fonts/ and licenses/ alongside the scripts and stylesheet.
Commit the changes and wait for GitHub Pages to finish deployment. Refresh the
page afterwards. Uploading the ZIP alone will not update the playable game.
The game also works by opening index.html locally in a WebGL-capable browser.

NEW MAPS
Five matching V2 models and road networks replace the previous map pack:
City Connected, Desert Connected, Alpine Connected, Coast Connected and Nature
Connected. Both main highways form complete continuous circuits. Only one map
is loaded at a time. Laps preserve the loaded map, speed, steering, camera,
traffic and sound; there is no road-end reload or switch to another highway.
Free Drive lets you choose the lower highway or flyover route. The two main
highways are playable; access ramps remain modeled scenery. Steering stays
within your two-lane carriageway; oncoming traffic stays across the divider.

SMOOTHER START AND DRIVING
All ten playable routes start on an actual straight section of the supplied
road, with at least 125 world meters of straight road ahead. The chase camera
starts behind the car immediately, followed by a brief READY / GO cue before
progressive acceleration. The mission clock starts with vehicle motion.
First traffic and pickup spawns are delayed to give the launch more space.
Four wheel contact samples follow the actual asphalt surface on the selected
deck. Dampened pitch, roll and chase camera reduce sudden visual movement.
The camera follows the highway direction independently of sideways steering;
nitro lens changes ease smoothly. Contact shadows help ground the vehicle.
Brake slows actual movement to zero. Releasing brake builds speed gradually;
nitro also builds speed progressively. The speedometer reports actual speed.

CAREER, GARAGE, SOUND AND MOBILE
100 levels and ten objective types remain, distributed across the five maps,
both main highways and varied lighting. Vehicle garage, Equip, upgrades, paint,
wallet and saved progression remain. Supplied garage supercars are player-only.
The illustrated loading banner and 16 embedded audio effects remain. Audio
starts after interaction and can be muted. Map selection shows loading once;
completing a lap does not show another loading screen.
A/D or Left/Right: steer. S/Down: brake. Space/Up: charged nitro. P: pause.
Mobile controls: left steering bottom left, brake above; right steering bottom
right, nitro above. The game frame stays 16:9. Fullscreen is optional; there is
no blocking rotate/fullscreen prompt.

PERFORMANCE AND GRAPHICS
Auto, High, Balanced and Smooth settings remain. Spatial mesh batches, material
merging, instanced coins, object reuse and resolution limits reduce rendering
work. Path interpolation reuses vectors. High adds shadows and asphalt relief;
mobile-friendly defaults retain lower rendering cost. Performance still depends
on the device. Supplied model style remains visible; this is an arcade racer.

CLEAN PACKAGE
Old map models, raw duplicate GLBs, preview pictures, import helpers, validation
reports, backup copies and development screenshots are excluded. Current maps
embed their matching GLB and road JSON in self-contained JS bundles. The game
requires no external model or sound download. Build source and dependency list
are included so the renderer can be maintained: npm install, then npm run build.
Third-party notices are in licenses/.
