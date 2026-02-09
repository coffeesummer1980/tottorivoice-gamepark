function updateCrabPosition() {
    const crab = document.getElementById('enemy-crab');
    // Basic oscillation to feel like it's chasing/lunging
    // It stays mostly on the left but lunges forward occasionally

    // Use gameTime to create a lunge pattern every few seconds
    const lungeCycle = (Date.now() / 1000) % 3; // 3 second cycle

    let targetLeft = -50;

    if (lungeCycle > 2.5) {
        // LUNGE!
        targetLeft = 20; // Get close to player (player is at 20%)
    } else {
        // Fall back slightly
        targetLeft = -50 + Math.sin(Date.now() / 200) * 10;
    }

    // Smooth interpolation could be done here, but CSS transition handles it well if we update style
    // However, updating style every frame with CSS transition on might be jittery or laggy depending on browser implementation of transition
    // Let's remove CSS transition for manual control or update rarely.

    // Actually, let's keep it simple: Just update position based on "danger" level?
    // Or just make it hover menacingly close.

    // Let's make it get closer as time runs out? NO, that's opposite of "survive".
    // Maybe get closer if you stay on ground too long? (Hard to track)

    // Let's stick to the "Lunge" idea but implemented simply.

    crab.style.left = targetLeft + 'px';
}
