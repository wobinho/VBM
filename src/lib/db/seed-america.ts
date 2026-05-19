import Database from 'better-sqlite3';
import type { LeagueConfig } from '../league-engine';
import { calculateOverall } from '../overall';

/**
 * Idempotent American (North + South + Central) seeder.
 *
 * Seeds 8 countries in one shot — USA, Canada, Mexico, Cuba, Puerto Rico,
 * Brazil, Argentina, Chile. Each country gets a single tier-2 league
 * (continent = 'America') containing 16 teams with 7 players each.
 *
 * Single-table format, Jan–Apr regular season + top-8 playoffs in May.
 * There are NO promotion/relegation links between any of these leagues.
 * A single shared league_presets row ('American Single-Tier Standard') is
 * inserted via INSERT OR IGNORE.
 */

interface CountrySeed {
    country: string;
    leagueName: string;
    teams: string[];
    firstNames: string[];
    lastNames: string[];
}

export function seedAmerica(db: Database.Database): void {
    // Skip entirely if USA (the first country in this seeder) is already present.
    const existing = db.prepare("SELECT COUNT(*) as c FROM leagues WHERE country = 'USA'").get() as { c: number };
    if (existing.c > 0) return;

    const americanConfig: LeagueConfig = {
        team_count: 16,
        format: { type: 'single_table' },
        regular_season: { rounds: 3, start_month: 1, start_day: 1, end_month: 4, end_day: 30 },
        post_season: {
            type: 'single_table_playoffs',
            start_month: 5,
            start_day: 1,
            series_length: 5,
            rounds: [
                { name: 'Quarter Finals', scope: 'whole_table', teams_count: 8, matchup_pattern: 'top_vs_bottom' },
                { name: 'Semi Finals',    scope: 'whole_table', matchup_pattern: 'top_vs_bottom' },
                { name: 'Grand Final',    scope: 'whole_table' },
            ],
        },
        tiebreakers: ['points', 'score_diff', 'set_diff'],
        cup_participation: {
            qualifier: 'top_n_per_league',
            top_n: 4,
            cups: ['national', 'cl'],
        },
    };

    const run = db.transaction(() => {
        const insertLeague = db.prepare(
            "INSERT INTO leagues (league_name, country, tier, continent) VALUES (?, ?, 2, 'America')"
        );
        const insertCfg = db.prepare(
            "INSERT OR IGNORE INTO league_configs (league_id, config) VALUES (?, ?)"
        );
        const insertTeam = db.prepare(
            "INSERT INTO teams (team_name, league_id, country, region, team_money) VALUES (?, ?, ?, NULL, ?)"
        );
        const insertPlayer = db.prepare(`
            INSERT INTO players (
                player_name, team_id, position, age, country, jersey_number, overall, potential,
                attack, defense, serve, block, receive, setting,
                precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
                speed, agility, strength, endurance, vertical, flexibility, torque, balance,
                leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
                contract_years, monthly_wage, player_value
            ) VALUES (
                @player_name, @team_id, @position, @age, @country, @jersey_number, @overall, @potential,
                @attack, @defense, @serve, @block, @receive, @setting,
                @precision, @flair, @digging, @positioning, @ball_control, @technique, @playmaking, @spin,
                @speed, @agility, @strength, @endurance, @vertical, @flexibility, @torque, @balance,
                @leadership, @teamwork, @concentration, @pressure, @consistency, @vision, @game_iq, @intimidation,
                @contract_years, @monthly_wage, @player_value
            )
        `);

        const positionOrder = ['Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Setter', 'Middle Blocker', 'Outside Hitter', 'Libero'];

        for (const seed of COUNTRY_SEEDS) {
            const leagueId = Number(insertLeague.run(seed.leagueName, seed.country).lastInsertRowid);
            insertCfg.run(leagueId, JSON.stringify(americanConfig));

            for (const teamName of seed.teams) {
                const money = randInt(10_000_000, 18_500_000);
                const teamId = Number(insertTeam.run(teamName, leagueId, seed.country, money).lastInsertRowid);

                const usedJerseys = new Set<number>();
                for (let p = 0; p < 7; p++) {
                    let jersey: number;
                    do { jersey = randInt(1, 99); } while (usedJerseys.has(jersey));
                    usedJerseys.add(jersey);
                    insertPlayer.run(generateAmericanPlayer(teamId, jersey, positionOrder[p], seed));
                }
            }
        }

        const insertPreset = db.prepare("INSERT OR IGNORE INTO league_presets (preset_name, config) VALUES (?, ?)");
        insertPreset.run('American Single-Tier Standard', JSON.stringify(americanConfig));
    });
    run();
}

// ---------------------------------------------------------------------------
// Team name pools (16 per country)
// ---------------------------------------------------------------------------

const USA_TEAMS = [
    'Los Angeles Coast', 'New York Skyline', 'Chicago Thunder', 'Miami Heatwave',
    'Houston Rockets VC', 'Dallas Stars Volleyball', 'San Francisco Surge', 'Seattle Tide',
    'Boston Patriots VC', 'Denver Altitude', 'Atlanta Phoenix', 'Phoenix Sun Devils VC',
    'Las Vegas Aces VC', 'Orlando Magic VC', 'Minnesota North Stars', 'San Diego Wave',
];

const CANADA_TEAMS = [
    'Toronto Maple Volleys', 'Montreal Carabins VC', 'Vancouver Thunderbirds', 'Calgary Dinos VC',
    'Edmonton Golden Bears', 'Ottawa Capital VC', 'Winnipeg Bisons', 'Quebec City Rouge',
    'Halifax Tides VC', 'Hamilton Steel VC', 'Saskatoon Huskies', 'Victoria Vikes VC',
    'Kingston Gaels VC', 'London Mustangs VC', 'Sherbrooke Volleyball', 'Regina Cougars VC',
];

const MEXICO_TEAMS = [
    'Pumas UNAM Voleibol', 'Tigres UANL Voleibol', 'Club América Voleibol', 'Chivas Guadalajara VC',
    'Monterrey Rayados VC', 'Toluca Diablos VC', 'Atlas Voleibol', 'Pachuca Tuzos VC',
    'León Esmeraldas VC', 'Querétaro Gallos VC', 'Mazatlán Voleibol', 'Puebla Camoteros VC',
    'Veracruz Tiburones', 'Mérida Halcones VC', 'Cancún Voleibol', 'Tijuana Xolos VC',
];

const CUBA_TEAMS = [
    'Ciego de Ávila Voleibol', 'La Habana Industriales VC', 'Matanzas Cocodrilos VC', 'Sancti Spíritus Gallos',
    'Villa Clara Naranjas VC', 'Camagüey Toros VC', 'Santiago de Cuba Avispas', 'Holguín Cachorros VC',
    'Cienfuegos Elefantes', 'Granma Alazanes VC', 'Pinar del Río Vegueros', 'Las Tunas Leñadores',
    'Guantánamo Indios VC', 'Artemisa Cazadores', 'Mayabeque Huracanes', 'Isla de la Juventud Piratas',
];

const PUERTO_RICO_TEAMS = [
    'Caguas Criollos VC', 'Mayagüez Indios VC', 'Ponce Leones VC', 'San Juan Capitalinos',
    'Bayamón Vaqueros VC', 'Arecibo Capitanes VC', 'Manatí Atenienses', 'Carolina Gigantes VC',
    'Guaynabo Mets VC', 'Humacao Grises VC', 'Aguadilla Tiburones', 'Fajardo Cariduros',
    'Yauco Brujos VC', 'Coamo Maratonistas', 'Cayey Toritos VC', 'Naranjito Cambalache',
];

const BRAZIL_TEAMS = [
    'Sada Cruzeiro', 'Sesc-RJ Flamengo', 'Minas Tênis Clube', 'Praia Clube',
    'Vôlei Renata', 'EMS Taubaté Funvic', 'Vôlei Guarulhos', 'Pinheiros Vôlei',
    'Apan Blumenau', 'Brasil Kirin Campinas', 'Vôlei Ribeirão', 'Corinthians Vôlei',
    'Maringá Vôlei', 'Joinville Vôlei', 'Vedacit Guarulhos', 'Fluminense Vôlei',
];

const ARGENTINA_TEAMS = [
    'UPCN Vóley San Juan', 'Bolívar Vóley', 'Personal Bolívar', 'Ciudad Vóley Buenos Aires',
    'Lomas Vóley', 'Obras San Juan', 'Monteros Vóley', 'Gigantes del Sur',
    'River Plate Vóley', 'Boca Juniors Vóley', 'Drean Bolívar', 'PSM Vóley',
    'Once Unidos Mar del Plata', 'San Lorenzo Vóley', 'Vélez Sarsfield Vóley', 'Estudiantes de La Plata VC',
];

const CHILE_TEAMS = [
    'Universidad de Chile Vóley', 'Club Manquehue', 'Linares Vóley', 'Thomas Bata VC',
    'Boston College Vóley', 'Universidad Católica Vóley', 'Stadio Italiano VC', 'Murialdo Vóley',
    'Colo-Colo Vóley', 'Club Palestino VC', 'Deportivo Concepción VC', 'Antofagasta Vóley',
    'Valparaíso Vóley', 'Temuco Vóley', 'Iquique Vóley', 'Punta Arenas Vóley',
];

// ---------------------------------------------------------------------------
// Name pools (>= 30 first names + >= 30 last names per country)
// ---------------------------------------------------------------------------

const USA_FIRST_NAMES = [
    'James', 'Michael', 'William', 'David', 'Joseph', 'Daniel', 'Matthew', 'Anthony',
    'Christopher', 'Andrew', 'Joshua', 'Ryan', 'Tyler', 'Brandon', 'Justin', 'Kevin',
    'Brian', 'Jason', 'Aaron', 'Eric', 'Jonathan', 'Nathan', 'Steven', 'Patrick',
    'Sean', 'Connor', 'Trevor', 'Dylan', 'Cody', 'Logan', 'Mason', 'Ethan',
    'Jacob', 'Noah', 'Liam', 'Lucas', 'Carter', 'Hunter', 'Tristan', 'Marcus',
];

const USA_LAST_NAMES = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
    'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White',
    'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young',
    'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
];

const CANADA_FIRST_NAMES = [
    'Liam', 'Noah', 'Oliver', 'William', 'Benjamin', 'Lucas', 'Henry', 'Alexander',
    'Mason', 'Ethan', 'Jacob', 'Logan', 'Jackson', 'Owen', 'Hudson', 'Caleb',
    'Olivier', 'Émile', 'Antoine', 'Gabriel', 'Tristan', 'Maxime', 'Hugo', 'Felix',
    'Charles', 'Nathan', 'Samuel', 'Thomas', 'Jeremy', 'Cameron', 'Connor', 'Riley',
    'Mathieu', 'Vincent', 'Étienne', 'Raphael', 'Léo', 'Adrien', 'Xavier', 'Julien',
];

const CANADA_LAST_NAMES = [
    'Smith', 'Tremblay', 'Martin', 'Brown', 'Roy', 'Wilson', 'MacDonald', 'Gagnon',
    'Johnson', 'Taylor', 'Anderson', 'Lavoie', 'Côté', 'Bouchard', 'Gauthier', 'Morin',
    'Lambert', 'Cloutier', 'Beaulieu', 'Pelletier', 'Lévesque', 'Bergeron', 'Leblanc', 'Paquette',
    'Girard', 'Simard', 'Boucher', 'Caron', 'Hamilton', 'Campbell', 'Stewart', 'Thompson',
    'Reid', 'Murray', 'MacKenzie', 'Fraser', 'Robinson', 'Clark', 'Mitchell', 'Scott',
];

const MEXICO_FIRST_NAMES = [
    'José', 'Juan', 'Luis', 'Miguel', 'Carlos', 'Jorge', 'Francisco', 'Manuel',
    'Pedro', 'Alejandro', 'Roberto', 'Fernando', 'Ricardo', 'Eduardo', 'Daniel', 'Diego',
    'Andrés', 'Antonio', 'Javier', 'Sergio', 'Hugo', 'Pablo', 'Raúl', 'Rafael',
    'Emilio', 'Mauricio', 'Adrián', 'Iván', 'Óscar', 'Cristian', 'Gerardo', 'Rodrigo',
    'Salvador', 'Héctor', 'Tomás', 'Vicente', 'Ignacio', 'Esteban', 'Armando', 'Gustavo',
];

const MEXICO_LAST_NAMES = [
    'Hernández', 'García', 'Martínez', 'López', 'González', 'Rodríguez', 'Pérez', 'Sánchez',
    'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Morales', 'Vázquez', 'Reyes', 'Jiménez',
    'Torres', 'Díaz', 'Ruiz', 'Ortiz', 'Castillo', 'Mendoza', 'Romero', 'Álvarez',
    'Aguilar', 'Vargas', 'Domínguez', 'Guerrero', 'Medina', 'Castro', 'Ramos', 'Rojas',
    'Salazar', 'Cortés', 'Delgado', 'Núñez', 'Peña', 'Ríos', 'Espinoza', 'Estrada',
];

const CUBA_FIRST_NAMES = [
    'Yoandry', 'Yosvany', 'Yosleidy', 'Yordan', 'Yasiel', 'Yulieski', 'Yunior', 'Yoel',
    'Leonardo', 'Robertlandy', 'Wilfredo', 'Osmany', 'Raydel', 'Roamy', 'Liván', 'Aldo',
    'Tomás', 'Orestes', 'Norberto', 'Alain', 'Frank', 'Daniel', 'Alexis', 'Antonio',
    'Bernardo', 'Carlos', 'Eliécer', 'Ernesto', 'Félix', 'Gilberto', 'Heriberto', 'Idael',
    'José', 'Luis', 'Manuel', 'Marcos', 'Pedro', 'Rolando', 'Sergio', 'Vladimir',
];

const CUBA_LAST_NAMES = [
    'González', 'Rodríguez', 'Pérez', 'Hernández', 'García', 'Martínez', 'López', 'Sánchez',
    'Fernández', 'Díaz', 'Ramírez', 'Suárez', 'Castro', 'Alfonso', 'Ortega', 'Valdés',
    'Cruz', 'Reyes', 'Morales', 'Torres', 'Acosta', 'Aguilera', 'Almeida', 'Arias',
    'Camejo', 'Cárdenas', 'Cepeda', 'Despaigne', 'Echevarría', 'Escobar', 'Figueroa', 'Gallardo',
    'Herrera', 'Iglesias', 'Leyva', 'Linares', 'Marrero', 'Mesa', 'Padilla', 'Quesada',
];

const PUERTO_RICO_FIRST_NAMES = [
    'Carlos', 'José', 'Juan', 'Luis', 'Miguel', 'Ángel', 'Roberto', 'Ramón',
    'Héctor', 'Iván', 'Pedro', 'Rafael', 'Eduardo', 'Francisco', 'Javier', 'Jorge',
    'Manuel', 'Mariano', 'Orlando', 'Rubén', 'Víctor', 'Wilfredo', 'Alex', 'Andrés',
    'Antonio', 'Benjamín', 'César', 'Cristian', 'Daniel', 'David', 'Diego', 'Emilio',
    'Enrique', 'Fernando', 'Gabriel', 'Gerardo', 'Israel', 'Joel', 'Lorenzo', 'Mateo',
];

const PUERTO_RICO_LAST_NAMES = [
    'Rivera', 'Rodríguez', 'Díaz', 'Pérez', 'González', 'Hernández', 'López', 'Martínez',
    'Sánchez', 'Torres', 'Vázquez', 'Reyes', 'Ramos', 'Cruz', 'Morales', 'Ortiz',
    'Rosario', 'Santiago', 'Colón', 'Figueroa', 'Maldonado', 'Ayala', 'Delgado', 'Rivas',
    'Burgos', 'Cintrón', 'Aponte', 'Vega', 'Negrón', 'Acevedo', 'Cordero', 'Camacho',
    'Padilla', 'Pagán', 'Quiñones', 'Robles', 'Soto', 'Toro', 'Valentín', 'Velázquez',
];

const BRAZIL_FIRST_NAMES = [
    'Lucas', 'Bruno', 'Rafael', 'Thiago', 'Wallace', 'Murilo', 'Ricardo', 'Mauricio',
    'Maurício', 'Sérgio', 'Giba', 'Dante', 'Gustavo', 'Leandro', 'Renan', 'Douglas',
    'Marcelo', 'Pedro', 'Felipe', 'Vinícius', 'Matheus', 'Gabriel', 'João', 'Caio',
    'André', 'Eduardo', 'Henrique', 'Igor', 'Luan', 'Rodrigo', 'Tiago', 'Victor',
    'Davi', 'Diego', 'Emanuel', 'Fábio', 'Guilherme', 'Hugo', 'Júnior', 'Kléber',
];

const BRAZIL_LAST_NAMES = [
    'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Ferreira', 'Costa',
    'Rodrigues', 'Almeida', 'Nascimento', 'Carvalho', 'Gomes', 'Martins', 'Araújo', 'Ribeiro',
    'Alves', 'Fernandes', 'Barbosa', 'Cardoso', 'Dias', 'Pinto', 'Moreira', 'Cavalcanti',
    'Rocha', 'Mendes', 'Marques', 'Freitas', 'Correia', 'Teixeira', 'Vieira', 'Macedo',
    'Andrade', 'Batista', 'Cunha', 'Duarte', 'Esteves', 'Figueiredo', 'Guimarães', 'Henriques',
];

const ARGENTINA_FIRST_NAMES = [
    'Facundo', 'Sebastián', 'Nicolás', 'Federico', 'Matías', 'Lucas', 'Diego', 'Martín',
    'Agustín', 'Tomás', 'Santiago', 'Bruno', 'Iván', 'Joaquín', 'Maximiliano', 'Pablo',
    'Gonzalo', 'Cristian', 'Lautaro', 'Ezequiel', 'Mauro', 'Emanuel', 'Hernán', 'Leandro',
    'Mariano', 'Rodrigo', 'Esteban', 'Franco', 'Gastón', 'Ignacio', 'Julián', 'Damián',
    'Alejandro', 'Andrés', 'Ariel', 'Ramiro', 'Javier', 'Luciano', 'Marcos', 'Néstor',
];

const ARGENTINA_LAST_NAMES = [
    'Fernández', 'González', 'Rodríguez', 'Gómez', 'López', 'Díaz', 'Martínez', 'Pérez',
    'García', 'Sánchez', 'Romero', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez',
    'Flores', 'Acosta', 'Benítez', 'Medina', 'Suárez', 'Herrera', 'Aguirre', 'Pereyra',
    'Rojas', 'Molina', 'Castro', 'Ortiz', 'Silva', 'Núñez', 'Luna', 'Cabrera',
    'Vega', 'Quiroga', 'Ríos', 'Méndez', 'Vargas', 'Giménez', 'Bianchi', 'Conte',
];

const CHILE_FIRST_NAMES = [
    'Sebastián', 'Cristóbal', 'Matías', 'Benjamín', 'Vicente', 'Joaquín', 'Diego', 'Tomás',
    'Agustín', 'Nicolás', 'Felipe', 'Maximiliano', 'Ignacio', 'Esteban', 'Camilo', 'Bastián',
    'Lucas', 'Martín', 'Gabriel', 'Pablo', 'Andrés', 'Javier', 'Rodrigo', 'Carlos',
    'Cristián', 'Alejandro', 'Eduardo', 'Fernando', 'Gonzalo', 'Hugo', 'Iván', 'Jaime',
    'Luis', 'Manuel', 'Marcelo', 'Mauricio', 'Pedro', 'Ricardo', 'Sergio', 'Víctor',
];

const CHILE_LAST_NAMES = [
    'González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva',
    'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres',
    'Araya', 'Flores', 'Espinoza', 'Valenzuela', 'Tapia', 'Castillo', 'Ramírez', 'Reyes',
    'Gutiérrez', 'Gómez', 'Carrasco', 'Vargas', 'Castro', 'Alvarez', 'Vásquez', 'Sandoval',
    'Cortés', 'Henríquez', 'Pizarro', 'Aravena', 'Bravo', 'Cáceres', 'Donoso', 'Escobar',
];

// ---------------------------------------------------------------------------
// Country seed list (order matters: USA first for the existence check)
// ---------------------------------------------------------------------------

const COUNTRY_SEEDS: CountrySeed[] = [
    { country: 'USA',         leagueName: 'USA Volleyball Pro League',     teams: USA_TEAMS,         firstNames: USA_FIRST_NAMES,         lastNames: USA_LAST_NAMES },
    { country: 'Canada',      leagueName: 'Canadian Volleyball League',    teams: CANADA_TEAMS,      firstNames: CANADA_FIRST_NAMES,      lastNames: CANADA_LAST_NAMES },
    { country: 'Mexico',      leagueName: 'Liga Mexicana de Voleibol',     teams: MEXICO_TEAMS,      firstNames: MEXICO_FIRST_NAMES,      lastNames: MEXICO_LAST_NAMES },
    { country: 'Cuba',        leagueName: 'Liga Cubana de Voleibol',       teams: CUBA_TEAMS,        firstNames: CUBA_FIRST_NAMES,        lastNames: CUBA_LAST_NAMES },
    { country: 'Puerto Rico', leagueName: 'Liga de Voleibol Superior',     teams: PUERTO_RICO_TEAMS, firstNames: PUERTO_RICO_FIRST_NAMES, lastNames: PUERTO_RICO_LAST_NAMES },
    { country: 'Brazil',      leagueName: 'Superliga Brasileira',          teams: BRAZIL_TEAMS,      firstNames: BRAZIL_FIRST_NAMES,      lastNames: BRAZIL_LAST_NAMES },
    { country: 'Argentina',   leagueName: 'Liga Argentina de Voleibol',    teams: ARGENTINA_TEAMS,   firstNames: ARGENTINA_FIRST_NAMES,   lastNames: ARGENTINA_LAST_NAMES },
    { country: 'Chile',       leagueName: 'Liga Nacional de Voleibol',     teams: CHILE_TEAMS,       firstNames: CHILE_FIRST_NAMES,       lastNames: CHILE_LAST_NAMES },
];

// ---------------------------------------------------------------------------
// Player generation
// ---------------------------------------------------------------------------

function generateAmericanPlayer(teamId: number, jerseyNumber: number, position: string, seed: CountrySeed) {
    const firstName = pick(seed.firstNames);
    const lastName = pick(seed.lastNames);
    const age = clamp(Math.round(randFloat(18, 36)), 16, 50);

    const overallTarget = randInt(60, 82);
    const s = (lo = 0.7, hi = 1.3) => clamp(Math.round(overallTarget * randFloat(lo, hi)), 1, 100);

    const attack = s();
    const defense = s();
    const serve = s();
    const block = s();
    const receive = s();
    const setting = s();

    const precision = s(0.65, 1.35);
    const flair = s(0.55, 1.40);
    const digging = s(0.65, 1.35);
    const positioning = s(0.70, 1.30);
    const ball_control = s(0.65, 1.35);
    const technique = s(0.65, 1.35);
    const playmaking = s(0.60, 1.35);
    const spin = s(0.55, 1.40);

    const speed = s(0.70, 1.30);
    const agility = s(0.70, 1.30);
    const strength = s(0.65, 1.35);
    const endurance = s(0.60, 1.40);
    const vertical = s(0.65, 1.35);
    const flexibility = s(0.65, 1.35);
    const torque = s(0.60, 1.35);
    const balance = s(0.70, 1.30);

    const leadership = s(0.50, 1.35);
    const teamwork = s(0.60, 1.30);
    const concentration = s(0.70, 1.30);
    const pressure = s(0.60, 1.30);
    const consistency = s(0.70, 1.30);
    const vision = s(0.60, 1.35);
    const game_iq = s(0.60, 1.35);
    const intimidation = s(0.50, 1.40);

    const overall = calculateOverall({
        attack, defense, serve, block, receive, setting,
        precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
        speed, agility, strength, endurance, vertical, flexibility, torque, balance,
        leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
    }, position);

    let headroom: number;
    if (age <= 20) headroom = randFloat(8, 20);
    else if (age <= 23) headroom = randFloat(5, 14);
    else if (age <= 26) headroom = randFloat(2, 9);
    else if (age <= 30) headroom = randFloat(0, 5);
    else headroom = randFloat(0, 2);
    const potential = clamp(overall + headroom, overall, 99);

    return {
        player_name: `${firstName} ${lastName}`,
        team_id: teamId,
        position,
        age,
        country: seed.country,
        jersey_number: jerseyNumber,
        overall,
        potential,
        attack, defense, serve, block, receive, setting,
        precision, flair, digging, positioning, ball_control, technique, playmaking, spin,
        speed, agility, strength, endurance, vertical, flexibility, torque, balance,
        leadership, teamwork, concentration, pressure, consistency, vision, game_iq, intimidation,
        contract_years: clamp(Math.round(randFloat(1, 5)), 1, 10),
        monthly_wage: Math.round(overall * randFloat(50, 200)),
        player_value: calculatePlayerValue(overall, age),
    };
}

function calculatePlayerValue(overall: number, age: number) {
    const baseValue = overall * 5000;
    let ageMod = 1.0;
    if (age < 22) ageMod = 1.3;
    else if (age < 25) ageMod = 1.1;
    else if (age < 30) ageMod = 1.0;
    else if (age < 35) ageMod = 0.8;
    else ageMod = 0.6;
    return Math.round(baseValue * ageMod);
}

function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, Math.round(val)));
}

function randFloat(min: number, max: number) {
    return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
