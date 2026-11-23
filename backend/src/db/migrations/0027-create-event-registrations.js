import { DataTypes } from 'sequelize';

/**
 * Event registration.
 *
 * Events already carried dates, venue and a banner but had no way to collect
 * attendance, so seminars and workshops were announced with no RSVP path.
 *
 * Registration is opt-in per event: `registration_open` defaults to false, so
 * adding this table does not retroactively put a form on every past event.
 */
export async function up(queryInterface) {
  const events = await queryInterface.describeTable('events');

  if (!events.registration_open) {
    await queryInterface.addColumn('events', 'registration_open', {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }

  if (!events.registration_capacity) {
    await queryInterface.addColumn('events', 'registration_capacity', {
      // Null means unlimited.
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  }

  if (!events.registration_deadline) {
    await queryInterface.addColumn('events', 'registration_deadline', {
      // Null means "until the event starts".
      type: DataTypes.DATE,
      allowNull: true,
    });
  }

  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('event_registrations')) {
    return;
  }

  await queryInterface.createTable('event_registrations', {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    event_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'events', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    name: { type: DataTypes.STRING(160), allowNull: false },
    email: { type: DataTypes.STRING(160), allowNull: false },
    phone: { type: DataTypes.STRING(32), allowNull: true },
    affiliation: { type: DataTypes.STRING(160), allowNull: true },
    // Free-text extras the organiser asked for (e.g. dietary needs).
    notes: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('registered', 'waitlisted', 'cancelled', 'attended'),
      allowNull: false,
      defaultValue: 'registered',
    },
    createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  });

  await queryInterface.addIndex('event_registrations', ['event_id'], {
    name: 'event_registrations_event_id',
  });

  // One registration per email per event. This is the only thing preventing a
  // double-submitted form from creating two attendees.
  await queryInterface.addIndex('event_registrations', ['event_id', 'email'], {
    name: 'event_registrations_unique_email',
    unique: true,
  });
}

export async function down(queryInterface) {
  const tables = await queryInterface.showAllTables();
  if (tables.map((t) => String(t).toLowerCase()).includes('event_registrations')) {
    await queryInterface.dropTable('event_registrations');
  }

  const events = await queryInterface.describeTable('events');
  for (const column of ['registration_open', 'registration_capacity', 'registration_deadline']) {
    if (events[column]) await queryInterface.removeColumn('events', column);
  }
}
