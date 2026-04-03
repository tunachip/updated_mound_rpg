// src/shared/constants.ts

export const DamageElements = [
	'water',
	'stone',
	'fire',
	'plant',
	'vital',
	'force',
	'thunder'
] as const;

export const Statuses = [
	'burn',				// take 1 fire damage on ticked
	'decay',			// take 1 force damage on ticked
	'wound',			// take 1 vital damage for each wound when shields break
	'curse',			// damage reduces maxHp in addition to damage
	'regen',			// gain 1 HP at start of turn
	'focus',			// gain 1 AP at start of turn
	'strong',			// attacks break +1 shield this turn
	'tough',			// gain 1 Shield at start of turn
	'slick',			// 10% Chance of Dodge Attacks for each
	'barbs',			// deal 1 plant damage to attackers when hit, falls off when hurt by fire
	'anger',			// must attack this turn if able to. non-attack moves are skipped
	'stun',				// cannot dodge attacks. attack moves are skipped
	'sleep',			// moves are skipped. gain 1 HP and 1 AP at end of turn
	'sick',				// gain 1 turn of each elemental status held (burn, decay, wound, curse) when ticked
] as const;

export const EntityTypes = [
	'controlled',	// controlled by the player
	'forecasted', // turn intent shows in the UI
	'hidden',			// turn intent is hidden
] as const;

export const MoveTypes = [
	'attack',
	'utility',
] as const;

export const ElementRelationships = {
	water: {
		stone: 'weak',
		fire: 'weak',
		plant: 'absorbs',
		thunder: 'resists',
	},
	stone: {
		water: 'resists',
		fire: 'weak',
		force: 'blocks',
		thunder: 'weak',
	},
	fire: {
		water: 'absorbs',
		stone: 'resists',
		plant: 'weak',
		vital: 'weak',
	},
	plant: {
		water: 'weak',
		stone: 'resists',
		fire: 'absorbs',
		vital: 'weak',
	},
	vital: {
		fire: 'resists',
		plant: 'weak',
		vital: 'weak',
		force: 'resists',
	},
	force: {
		stone: 'weak',
		plant: 'resists',
		vital: 'weak',
		thunder: 'blocks',
	},
	thunder: {
		water: 'weak',
		stone: 'blocks',
		force: 'weak',
	},
} as const;

export const TargetTypes = [
	'self',
	'ally',
	'enemy',
	'entity',
	'move',
	'blessing',
] as const;

export const ModifierExpressions = [
	'plus',
	'minus',
	'times',
	'dividedBy',
	'overwrittenBy',
	'merge',
	'insertAtStart',
	'insertAtEnd',
	'insertAtStartOfLoop',
	'insertAtEndOfLoop',
] as const;

export const ListenerTypes = [
	'interrupt',
	'sideEffect',
] as const;
