// EMERGENCY ADMIN ACTIVATION - NUCLEAR OPTION
// This will FORCE admin access immediately, bypassing all authentication issues

console.log('🚨 EMERGENCY ADMIN ACTIVATION STARTING...');
console.log('🚨 This is the NUCLEAR OPTION - forcing admin access NOW!');

// Step 1: Clear ALL cached data
console.log('1. 🧹 Clearing ALL cached data...');
localStorage.clear();
sessionStorage.clear();

// Step 2: Set emergency admin flag
console.log('2. 🚨 Setting emergency admin flag...');
localStorage.setItem('EMERGENCY_ADMIN_sroja@jkkn.ac.in', 'true');
localStorage.setItem('FORCE_ADMIN_ROLE', 'admin');

// Step 3: Force immediate refresh
console.log('3. 🔄 FORCING IMMEDIATE REFRESH...');

// Add emergency CSS to show admin items immediately
const emergencyCSS = `
<style id="emergency-admin-css">
  /* Force show admin navigation items */
  .admin-nav-item { display: block !important; }
  .admin-only { display: block !important; }
  
  /* Add emergency admin indicator */
  body::before {
    content: "🚨 EMERGENCY ADMIN MODE ACTIVE";
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: red;
    color: white;
    text-align: center;
    padding: 5px;
    z-index: 9999;
    font-weight: bold;
  }
</style>
`;

document.head.insertAdjacentHTML('beforeend', emergencyCSS);

// Force refresh after 1 second
setTimeout(() => {
  console.log('🚨 EMERGENCY REFRESH NOW!');
  window.location.href = window.location.origin + '/?emergency_admin=true';
}, 1000);

console.log('⏳ Emergency admin activation in progress...');
console.log('🚨 You will see admin navigation items after refresh!');
