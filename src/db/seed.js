const pool = require('./pool');

async function seed() {
  try {
    // Get the first user to assign gems to
    const userResult = await pool.query(`SELECT "userID" FROM "user" LIMIT 1`);
    if (userResult.rows.length === 0) {
      console.log('No users found - register a user first');
      process.exit(1);
    }
    const userID = userResult.rows[0].userID;

    // Insert sample gems
    const gems = [
      {
        name: 'Secret Waterfall Trail',
        description: 'Hidden behind the old mill, this stunning waterfall is only known to locals. The hike is about 20 minutes but absolutely worth it.',
        category: 'Nature',
        latitude: 38.6270,
        longitude: -90.1994,
        location_label: 'Forest Park, St. Louis',
      },
      {
        name: '1970s Tile Mosaic — Calle 24',
        description: 'A stunning piece of community art hidden on the side of a building. Most people walk right past it without looking up.',
        category: 'Art',
        latitude: 38.6430,
        longitude: -90.2290,
        location_label: 'Cherokee Street, St. Louis',
      },
      {
        name: 'Rooftop Garden Oasis',
        description: 'Tucked behind an unassuming door on the 4th floor. Ring the bell and ask for the garden. Completely free and open to the public.',
        category: 'Nature',
        latitude: 38.6331,
        longitude: -90.2021,
        location_label: 'Downtown St. Louis',
      },
      {
        name: 'Secret Speakeasy Café',
        description: 'No sign outside. Walk through the bookstore, past the mystery section, through the red door. Best espresso in the city.',
        category: 'Food',
        latitude: 38.6488,
        longitude: -90.3108,
        location_label: 'Maplewood, St. Louis',
      },
      {
        name: 'Civil War Era Tunnel',
        description: 'An underground tunnel dating back to the 1860s. Tours run on weekends — ask at the visitor center.',
        category: 'Historic',
        latitude: 38.5767,
        longitude: -90.2830,
        location_label: 'South St. Louis',
      },
    ];

    for (const gem of gems) {
      const result = await pool.query(
        `INSERT INTO gem ("userID", name, description, category, latitude, longitude, location_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING "gemID"`,
        [userID, gem.name, gem.description, gem.category, gem.latitude, gem.longitude, gem.location_label]
      );
      const gemID = result.rows[0].gemID;

      // Add tags
      const tagMap = {
        'Nature':   ['nature', 'outdoors'],
        'Art':      ['art', 'urban'],
        'Food':     ['food', 'coffee'],
        'Historic': ['historic', 'culture'],
      };
      const tags = tagMap[gem.category] || [];
      for (const tag of tags) {
        await pool.query(
          `INSERT INTO tag ("gemID", name) VALUES ($1, $2)`,
          [gemID, tag]
        );
      }
    }

    console.log('✓ Seed data inserted');
    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  }
}

seed();