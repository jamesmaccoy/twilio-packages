// Script to update package yocoId to avoid matching mock Yoco products
// Run this from your project root after starting your dev server

const packageId = '6922a0229ee95dfe5863ef2d';
const newYocoId = 'condominium_pro_75000'; // Unique ID that won't match mock products

const updatePackage = async () => {
  try {
    const response = await fetch(`http://localhost:3000/api/packages/${packageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        yocoId: newYocoId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update package');
    }

    const updated = await response.json();
    console.log('✅ Package updated successfully!');
    console.log('New yocoId:', updated.yocoId);
    return updated;
  } catch (error) {
    console.error('❌ Error updating package:', error);
    throw error;
  }
};

// Uncomment to run:
// updatePackage();

console.log(`
To update the package yocoId, you can:

1. Use the Payload CMS admin panel:
   - Go to /admin/collections/packages/6922a0229ee95dfe5863ef2d
   - Edit the "Yoco ID" field
   - Change it from "per_hour_luxury" to "condominium_pro_75000"
   - Save

2. Or make a PATCH request:
   PATCH /api/packages/6922a0229ee95dfe5863ef2d
   Body: { "yocoId": "condominium_pro_75000" }

3. Or run this script (uncomment the updatePackage() call above)
`);

