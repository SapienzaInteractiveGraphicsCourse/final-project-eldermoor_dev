![Eldermoor](banner_title.png)

# ELDERMOOR

**Eldermoor** is a third-person exploration adventure set in the fog-veiled valley of the Hollow Vale. Wander the winding streets of a medieval village nestled beneath an ancient cliffside castle, talk to its townsfolk, take on quests and uncover the quiet mysteries hidden among its mills, fountains and lantern-lit squares. Built with Three.js.

🎮 **[Play the demo](https://sapienzainteractivegraphicscourse.github.io/final-project-eldermoor_dev/)** 
> It may take a little while to load — but it's worth the wait.

## Course Requirements
* **Hierarchical models:** a fully rigged elven character (skinned mesh driven by a bone hierarchy), wandering NPCs and grouped world props such as windmills, market stalls, wells, banners and lamp posts.
* **Lights and textures:** hemisphere and directional lights with real-time shadow casting, plus a dynamic day/night cycle; lamp posts with emissive light sources that switch on at dusk. Materials use normal, roughness, ambient-occlusion and bump maps, emissive surfaces, and procedurally generated canvas textures.
* **User interaction:** third-person character control with view-relative movement, mouse-driven orbit camera with scroll zoom, proximity-based NPC dialogue, an openable inventory, a quest system and an on-screen HUD with character portrait and health bar.
* **Animations:** a procedural walk cycle and idle/rest pose for the character, jumping, smooth follow-camera motion, autonomous NPC wandering, a continuous day/night lighting transition and animated world elements (windmill, water, fields).
  
## Controls
**Movement (third-person)**
* `W` / `Up` -- move forward
* `S` / `Down` -- move backward
* `A` / `Left` -- strafe / turn left
* `D` / `Right` -- strafe / turn right
* `Shift` -- run
* `Space` -- jump

**Camera**
* `Mouse drag` -- orbit the camera around the character
* `Mouse wheel` -- zoom in / out
  
**Interaction**
* `E` -- talk to the nearest NPC
* `F` -- gather a nearby herb
* `I` -- open / close the inventory
* `Esc` -- close the active dialogue

## Libraries
* [Three.js](https://threejs.org/) `r160` (loaded via CDN with an import map)
* Three.js addons: `OrbitControls`, `GLTFLoader`, `OBJLoader`, `MTLLoader`, `RoomEnvironment`
* [Cinzel](https://fonts.google.com/specimen/Cinzel) / Cinzel Decorative (Google Fonts) for the medieval UI typography



