import Database from 'better-sqlite3';
import type { LeagueConfig } from '../league-engine';
import { calculateOverall } from '../overall';

/**
 * Idempotent European extras seeder.
 *
 * Inserts twelve European countries at once: Slovenia, Bulgaria, Germany,
 * Serbia, Belgium, Russia, Ukraine, Czechia, Finland, Netherlands, Portugal
 * and Spain. Each country gets a single tier-2 league with 16 teams and
 * 7 players per team. Each league runs Jan-Apr with a top-8 playoff
 * bracket. There is NO promotion/relegation chain for any of these new
 * leagues (no league_links rows). One shared league_presets row is
 * inserted with name 'European Single-Tier Standard'.
 */

interface CountryData {
    country: string;
    leagueName: string;
    teams: string[];
    firstNames: string[];
    lastNames: string[];
}

export function seedEuropeExtras(db: Database.Database, countries?: string[]): void {
    // Skip entirely if Slovenia (the first country in this seeder) is already present.
    const existing = db.prepare("SELECT COUNT(*) as c FROM leagues WHERE country = 'Slovenia'").get() as { c: number };
    if (existing.c > 0) return;

    const run = db.transaction(() => {
        const sharedConfig = buildSharedConfig();

        const insertLeague = db.prepare(
            "INSERT INTO leagues (league_name, country, tier, continent) VALUES (?, ?, 2, 'Europe')"
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
        const configJson = JSON.stringify(sharedConfig);

        const countriesToSeed = countries
            ? COUNTRIES.filter(c => countries.includes(c.country))
            : COUNTRIES;

        for (const country of countriesToSeed) {
            const leagueId = Number(insertLeague.run(country.leagueName, country.country).lastInsertRowid);
            insertCfg.run(leagueId, configJson);

            for (const teamName of country.teams) {
                const money = randInt(10_000_000, 18_500_000);
                const teamId = Number(insertTeam.run(teamName, leagueId, country.country, money).lastInsertRowid);

                const usedJerseys = new Set<number>();
                for (let p = 0; p < 7; p++) {
                    let jersey: number;
                    do { jersey = randInt(1, 99); } while (usedJerseys.has(jersey));
                    usedJerseys.add(jersey);
                    insertPlayer.run(generatePlayer(teamId, jersey, positionOrder[p], country));
                }
            }
        }

        const insertPreset = db.prepare("INSERT OR IGNORE INTO league_presets (preset_name, config) VALUES (?, ?)");
        insertPreset.run('European Single-Tier Standard', configJson);
    });
    run();
}

function buildSharedConfig(): LeagueConfig {
    const config: LeagueConfig = {
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
    return config;
}

// ---------------------------------------------------------------------------
// Name pools per country (30+ first names and 30+ last names each)
// ---------------------------------------------------------------------------

const SLOVENIAN_FIRST_NAMES = [
    'Luka', 'Matej', 'Jan', 'Tine', 'Klemen', 'Gregor', 'Nik', 'Žiga',
    'Mitja', 'Rok', 'Aleš', 'Domen', 'Tomaž', 'Andraž', 'Dejan', 'Sašo',
    'Blaž', 'Miha', 'Vid', 'Anže', 'Urban', 'Marko', 'Primož', 'Boštjan',
    'Janez', 'Damjan', 'Jure', 'Tilen', 'Borut', 'Dragan', 'Kristjan', 'Sebastjan',
];

const SLOVENIAN_LAST_NAMES = [
    'Novak', 'Horvat', 'Kovačič', 'Krašovec', 'Vidmar', 'Zupan', 'Kos', 'Mlakar',
    'Petrović', 'Hribar', 'Šešum', 'Kozamernik', 'Čebulj', 'Štern', 'Pajenk', 'Urnaut',
    'Gasparini', 'Toncek', 'Pavlič', 'Ropret', 'Vidič', 'Kotnik', 'Rebec', 'Klobučar',
    'Pleško', 'Bračko', 'Bregar', 'Zupančič', 'Pernuš', 'Mihelič', 'Šket', 'Lukan',
];

const BULGARIAN_FIRST_NAMES = [
    'Matey', 'Tsvetan', 'Viktor', 'Nikolay', 'Georgi', 'Aleksandar', 'Tsvetomir', 'Vladislav',
    'Boyan', 'Plamen', 'Rosen', 'Stoyan', 'Dimitar', 'Ivaylo', 'Krasimir', 'Lyubomir',
    'Martin', 'Petar', 'Radoslav', 'Stefan', 'Todor', 'Ventsislav', 'Yordan', 'Zlatko',
    'Asparuh', 'Borislav', 'Hristo', 'Iliyan', 'Kaloyan', 'Milen', 'Nikola', 'Ognyan',
];

const BULGARIAN_LAST_NAMES = [
    'Kazyiski', 'Sokolov', 'Bratoev', 'Salparov', 'Yosifov', 'Penchev', 'Aleksiev', 'Skrimov',
    'Nikolov', 'Dimitrov', 'Ivanov', 'Petrov', 'Georgiev', 'Stoyanov', 'Hristov', 'Todorov',
    'Yordanov', 'Iliev', 'Marinov', 'Vasilev', 'Mihaylov', 'Kostov', 'Pavlov', 'Atanasov',
    'Borisov', 'Kolev', 'Angelov', 'Tsvetkov', 'Zlatev', 'Mladenov', 'Spasov', 'Karaivanov',
];

const GERMAN_FIRST_NAMES = [
    'Lukas', 'Maximilian', 'Jonas', 'Felix', 'Moritz', 'Tobias', 'Sebastian', 'Christian',
    'Markus', 'Andreas', 'Stefan', 'Thomas', 'Florian', 'Daniel', 'Patrick', 'Julian',
    'Niklas', 'Simon', 'Philipp', 'Benedikt', 'Leon', 'Tim', 'Fabian', 'Jan',
    'Kai', 'Hendrik', 'Marvin', 'Dennis', 'Alexander', 'Nico', 'Sven', 'Bastian',
];

const GERMAN_LAST_NAMES = [
    'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Meyer', 'Wagner', 'Becker',
    'Schulz', 'Hoffmann', 'Schäfer', 'Koch', 'Bauer', 'Richter', 'Klein', 'Wolf',
    'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger', 'Hofmann', 'Hartmann',
    'Lange', 'Schmitt', 'Werner', 'Krause', 'Lehmann', 'Köhler', 'Herrmann', 'König',
];

const SERBIAN_FIRST_NAMES = [
    'Nikola', 'Marko', 'Stefan', 'Aleksandar', 'Dušan', 'Miloš', 'Petar', 'Uroš',
    'Vladimir', 'Vukašin', 'Ivan', 'Filip', 'Lazar', 'Andrija', 'Bogdan', 'Branislav',
    'Dragan', 'Đorđe', 'Goran', 'Jovan', 'Luka', 'Mihajlo', 'Nemanja', 'Predrag',
    'Radomir', 'Slobodan', 'Tomislav', 'Veljko', 'Zoran', 'Mladen', 'Strahinja', 'Boban',
];

const SERBIAN_LAST_NAMES = [
    'Kovačević', 'Atanasijević', 'Podraščanin', 'Petrić', 'Mitić', 'Rosić', 'Lisinac', 'Ivović',
    'Jovović', 'Petković', 'Stanković', 'Nikolić', 'Marković', 'Đorđević', 'Pavlović', 'Jovanović',
    'Popović', 'Lukić', 'Tomić', 'Ilić', 'Radovanović', 'Krstić', 'Vukčević', 'Mijailović',
    'Simić', 'Filipović', 'Mihailović', 'Janković', 'Ristić', 'Adamović', 'Vukotić', 'Babić',
];

const BELGIAN_FIRST_NAMES = [
    'Jonas', 'Tomas', 'Sam', 'Pieter', 'Bram', 'Wout', 'Sander', 'Bart',
    'Stijn', 'Kevin', 'Jeroen', 'Maarten', 'Jelle', 'Lars', 'Robin', 'Niels',
    'Thibault', 'Hugo', 'Arthur', 'Maxime', 'Lucas', 'Antoine', 'Nicolas', 'Hendrik',
    'Mathias', 'Tom', 'Joren', 'Dries', 'Karel', 'Frederik', 'Olivier', 'Quentin',
];

const BELGIAN_LAST_NAMES = [
    'Deroo', 'Verhanneman', 'Coolman', 'Depovere', 'D\'Hulst', 'Reggers', 'Rousseaux', 'Carlier',
    'Vermeulen', 'Janssens', 'Maes', 'Jacobs', 'Peeters', 'Willems', 'Claes', 'Wouters',
    'De Smet', 'Dubois', 'Lambert', 'Goossens', 'De Vos', 'Hermans', 'Mertens', 'Aerts',
    'Lemmens', 'Cools', 'Smet', 'Pauwels', 'Van Damme', 'Van den Berg', 'De Clercq', 'Verhoeven',
];

const RUSSIAN_FIRST_NAMES = [
    'Maxim', 'Dmitry', 'Andrey', 'Alexey', 'Igor', 'Mikhail', 'Pavel', 'Sergey',
    'Yaroslav', 'Egor', 'Konstantin', 'Vadim', 'Roman', 'Anton', 'Artem', 'Denis',
    'Evgeny', 'Fyodor', 'Gleb', 'Ilya', 'Kirill', 'Leonid', 'Nikita', 'Oleg',
    'Pyotr', 'Ruslan', 'Stanislav', 'Timofey', 'Valeriy', 'Vladimir', 'Yegor', 'Zakhar',
];

const RUSSIAN_LAST_NAMES = [
    'Mikhaylov', 'Volkov', 'Muserskiy', 'Kliuka', 'Ashchev', 'Kobzar', 'Poletaev', 'Spiridonov',
    'Pankov', 'Tetyukhin', 'Zaytsev', 'Ivanov', 'Smirnov', 'Kuznetsov', 'Popov', 'Sokolov',
    'Lebedev', 'Kozlov', 'Novikov', 'Morozov', 'Petrov', 'Solovyov', 'Vasilyev', 'Pavlov',
    'Semyonov', 'Golubev', 'Vinogradov', 'Bogdanov', 'Vorobyov', 'Fyodorov', 'Mikhaylin', 'Belyaev',
];

const UKRAINIAN_FIRST_NAMES = [
    'Oleh', 'Yurii', 'Volodymyr', 'Andrii', 'Dmytro', 'Mykola', 'Serhii', 'Vasyl',
    'Bohdan', 'Maksym', 'Oleksandr', 'Pavlo', 'Ihor', 'Vitalii', 'Mykhailo', 'Roman',
    'Vadym', 'Yaroslav', 'Stepan', 'Taras', 'Petro', 'Ruslan', 'Anatolii', 'Borys',
    'Denys', 'Hryhorii', 'Kostiantyn', 'Leonid', 'Oleksii', 'Stanislav', 'Valerii', 'Yevhen',
];

const UKRAINIAN_LAST_NAMES = [
    'Shevchenko', 'Boyko', 'Kovalenko', 'Bondarenko', 'Tkachenko', 'Kravchenko', 'Oliinyk', 'Shevchuk',
    'Polishchuk', 'Marchenko', 'Lysenko', 'Rudenko', 'Mazur', 'Savchenko', 'Hrytsenko', 'Petrenko',
    'Romanenko', 'Moroz', 'Ivanenko', 'Pavlenko', 'Honcharenko', 'Yermolenko', 'Kostenko', 'Vasylenko',
    'Klymenko', 'Lytvyn', 'Bondar', 'Tymoshenko', 'Melnyk', 'Koval', 'Romaniuk', 'Sydorenko',
];

const CZECH_FIRST_NAMES = [
    'Jakub', 'Lukáš', 'Tomáš', 'Jan', 'Martin', 'Petr', 'Pavel', 'Michal',
    'David', 'Filip', 'Adam', 'Vojtěch', 'Ondřej', 'Marek', 'Daniel', 'Štěpán',
    'Václav', 'Roman', 'Karel', 'Radek', 'Jaroslav', 'Miroslav', 'Zdeněk', 'Aleš',
    'Patrik', 'Jiří', 'Matěj', 'Dominik', 'Vladimír', 'Antonín', 'František', 'Milan',
];

const CZECH_LAST_NAMES = [
    'Novák', 'Svoboda', 'Novotný', 'Dvořák', 'Černý', 'Procházka', 'Kučera', 'Veselý',
    'Horák', 'Němec', 'Marek', 'Pokorný', 'Pospíšil', 'Hájek', 'Jelínek', 'Král',
    'Růžička', 'Beneš', 'Fiala', 'Sedláček', 'Doležal', 'Zeman', 'Kolář', 'Navrátil',
    'Čermák', 'Urban', 'Vaněk', 'Bláha', 'Janda', 'Kratochvíl', 'Štěpánek', 'Holub',
];

const FINNISH_FIRST_NAMES = [
    'Mikko', 'Olli', 'Antti', 'Sami', 'Joonas', 'Tommi', 'Tuomas', 'Matias',
    'Eemeli', 'Janne', 'Juho', 'Niko', 'Petteri', 'Lauri', 'Eero', 'Aleksi',
    'Markus', 'Henri', 'Konsta', 'Jukka', 'Tero', 'Ville', 'Aki', 'Jere',
    'Onni', 'Veeti', 'Patrik', 'Joel', 'Severi', 'Otso', 'Kalle', 'Roope',
];

const FINNISH_LAST_NAMES = [
    'Korhonen', 'Virtanen', 'Mäkinen', 'Nieminen', 'Mäkelä', 'Hämäläinen', 'Laine', 'Heikkinen',
    'Koskinen', 'Järvinen', 'Lehtonen', 'Lehtinen', 'Saarinen', 'Salminen', 'Heinonen', 'Niemi',
    'Heikkilä', 'Kinnunen', 'Salonen', 'Turunen', 'Salo', 'Laitinen', 'Tuominen', 'Rantanen',
    'Karjalainen', 'Jokinen', 'Mattila', 'Savolainen', 'Lahtinen', 'Ahonen', 'Ojala', 'Leppänen',
];

const DUTCH_FIRST_NAMES = [
    'Daan', 'Sven', 'Bram', 'Lars', 'Thijs', 'Stijn', 'Tijs', 'Niels',
    'Sem', 'Joep', 'Jurrit', 'Maarten', 'Wessel', 'Twan', 'Bas', 'Robin',
    'Sander', 'Pim', 'Ruben', 'Lucas', 'Finn', 'Levi', 'Noah', 'Mees',
    'Tygo', 'Jort', 'Roel', 'Koen', 'Tim', 'Mike', 'Jasper', 'Hidde',
];

const DUTCH_LAST_NAMES = [
    'de Jong', 'Jansen', 'de Vries', 'van den Berg', 'van Dijk', 'Bakker', 'Janssen', 'Visser',
    'Smit', 'Meijer', 'de Boer', 'Mulder', 'de Groot', 'Bos', 'Vos', 'Peters',
    'Hendriks', 'van Leeuwen', 'Dekker', 'Brouwer', 'de Wit', 'Dijkstra', 'Smits', 'de Graaf',
    'van der Meer', 'Konings', 'Plak', 'Abdel-Aziz', 'ter Horst', 'Keemink', 'Schouten', 'van Garderen',
];

const PORTUGUESE_FIRST_NAMES = [
    'João', 'Miguel', 'Tiago', 'Bruno', 'André', 'Rui', 'Hugo', 'Pedro',
    'Diogo', 'Ricardo', 'Nuno', 'Gonçalo', 'Filipe', 'Vasco', 'Henrique', 'Tomás',
    'Rafael', 'Fábio', 'Daniel', 'Eduardo', 'Alexandre', 'Carlos', 'Manuel', 'Sérgio',
    'Luís', 'Marco', 'Paulo', 'Vítor', 'Afonso', 'Duarte', 'Joaquim', 'Mauro',
];

const PORTUGUESE_LAST_NAMES = [
    'Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins',
    'Sousa', 'Carvalho', 'Almeida', 'Lopes', 'Marques', 'Alves', 'Gomes', 'Ribeiro',
    'Mendes', 'Nunes', 'Soares', 'Vieira', 'Monteiro', 'Cardoso', 'Rocha', 'Neves',
    'Coelho', 'Cruz', 'Cunha', 'Pires', 'Reis', 'Simões', 'Antunes', 'Fonseca',
];

const SPANISH_FIRST_NAMES = [
    'Javier', 'Carlos', 'Daniel', 'Jorge', 'Sergio', 'Pablo', 'Álvaro', 'Adrián',
    'Rubén', 'Iván', 'Diego', 'Hugo', 'Marcos', 'Andrés', 'Manuel', 'Antonio',
    'Francisco', 'José', 'Miguel', 'Alejandro', 'Mario', 'Raúl', 'Fernando', 'Borja',
    'Iker', 'Aitor', 'Pau', 'Joel', 'Víctor', 'Nacho', 'Roberto', 'Guillermo',
];

const SPANISH_LAST_NAMES = [
    'García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'González', 'Rodríguez', 'Fernández',
    'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Álvarez',
    'Muñoz', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro', 'Torres', 'Domínguez', 'Vázquez',
    'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina', 'Suárez', 'Castro',
];

// ---------------------------------------------------------------------------
// Team name pools per country (16 teams each)
// ---------------------------------------------------------------------------

const SLOVENIA_TEAMS = [
    'ACH Volley Ljubljana', 'Calcit Volley Kamnik', 'Merkur Maribor', 'OK Salonit Anhovo',
    'Panvita Pomgrad', 'Šoštanj Topolšica', 'Hoče', 'OK Krka Novo Mesto',
    'Mladi Jesenice', 'OK Triglav Kranj', 'Šempeter', 'OK Fužinar Ravne',
    'OK Črnuče', 'Murska Sobota', 'Koper', 'Velenje',
];

const BULGARIA_TEAMS = [
    'Levski Sofia', 'CSKA Sofia', 'Dobrudzha Dobrich', 'Hebar Pazardzhik',
    'Neftohimik Burgas', 'Pirin Razlog', 'Slavia Sofia', 'Montana Volleyball',
    'Cherno More Varna', 'Botev Lukovit', 'Beroe Stara Zagora', 'Lokomotiv Plovdiv',
    'Vitosha Sofia', 'Marek Dupnitsa', 'Arda Kardzhali', 'Rakovski Volley',
];

const GERMANY_TEAMS = [
    'Berlin Recycling Volleys', 'VfB Friedrichshafen', 'SVG Lüneburg', 'United Volleys Frankfurt',
    'Hypo Tirol Alpenvolleys', 'Helios Grizzlys Giesen', 'WWK Volleys Herrsching', 'TSV Haching München',
    'SWD powervolleys Düren', 'Netzhoppers KW-Bestensee', 'VC Bitterfeld-Wolfen', 'TV Rottenburg',
    'Volleyball Bisons Bühl', 'eltro VC Bottrop', 'TuS Mondorf', 'TSV Mühldorf',
];

const SERBIA_TEAMS = [
    'Crvena Zvezda Belgrade', 'Partizan Belgrade', 'OK Vojvodina Novi Sad', 'OK Ribnica Kraljevo',
    'OK Spartak Subotica', 'OK Borac Starčevo', 'OK Mladi Radnik Požarevac', 'OK Železničar Lajkovac',
    'OK Niš', 'OK Klek Srbijašume', 'OK Smederevo', 'OK Jedinstvo Užice',
    'OK Radnički Kragujevac', 'OK Putevi Užice', 'OK Obilić Novi Sad', 'OK Dunav Stari Banovci',
];

const BELGIUM_TEAMS = [
    'Knack Roeselare', 'Greenyard Maaseik', 'Lindemans Aalst', 'Decospan VT Menen',
    'Achel Volleyteam', 'Caruur Gent', 'Tectum Achel', 'Haasrode Leuven',
    'Guibertin Volley', 'Volley Asse-Lennik', 'Antwerp Volley', 'VHL Albatros',
    'Borgworm Volley', 'Maes Pils Zellik', 'Charleroi Volley', 'Brugge Volley',
];

const RUSSIA_TEAMS = [
    'Zenit Kazan', 'Zenit St. Petersburg', 'Dynamo Moscow', 'Lokomotiv Novosibirsk',
    'Belogorie Belgorod', 'Fakel Novy Urengoy', 'Ural Ufa', 'Kuzbass Kemerovo',
    'Yenisei Krasnoyarsk', 'Gazprom-Yugra Surgut', 'Dynamo-LO Sosnovy Bor', 'Nova Novokuibyshevsk',
    'AKS Astrakhan', 'Yaroslavich Yaroslavl', 'Neftyanik Orenburg', 'Tatra Stolitsa Volgograd',
];

const UKRAINE_TEAMS = [
    'Barkom-Kazhany Lviv', 'VK Lokomotyv Kharkiv', 'VC Epicentr-Podoliany', 'Burevisnyk-ShVSM',
    'MHP-Vinnytsia', 'Reshetylivka', 'Krukivskyi VRZ', 'Yuvileinyi Chernihiv',
    'VK Kyiv', 'Dnipro Volley', 'Odesa Sharks', 'Karpaty Uzhhorod',
    'Polissya Zhytomyr', 'Cherkasy Volley', 'Mykolaiv VK', 'Sumy Volleyball',
];

const CZECHIA_TEAMS = [
    'VK Karlovarsko', 'Volejbal Brno', 'VK ČEZ Karlovarsko', 'Dukla Liberec',
    'Kladno Volejbal', 'Volejbal Ostrava', 'VK Příbram', 'VK Lvi Praha',
    'Aero Odolena Voda', 'ČZU Praha', 'Volejbal Beskydy', 'VK Ústí nad Labem',
    'VK Jihostroj České Budějovice', 'Spartak Hradec Králové', 'Volleyball Plzeň', 'Slavia Praha',
];

const FINLAND_TEAMS = [
    'Tiikerit Kokkola', 'Sastamala Vampula', 'VaLePa Sastamala', 'Hurrikaani Loimaa',
    'Akaa-Volley', 'Saimaa Volley', 'Etta Espoo', 'Salo Volley',
    'Vammalan Lentopallo', 'Lentopallon Pohjankyrö', 'Raision Loimu', 'Karelian Hurmos',
    'Pielaveden Sampo', 'Oulun Etta', 'Tampere Volley', 'Lapuan Virkiä',
];

const NETHERLANDS_TEAMS = [
    'Lycurgus Groningen', 'ZVH Volleybal', 'Orion Doetinchem', 'Dynamo Apeldoorn',
    'Sliedrecht Sport', 'Talent Team Papendal', 'VoCASA Nijmegen', 'Inter Rijswijk',
    'AMVJ Amstelveen', 'Volley Tilburg', 'Volleyclub Utrecht', 'Eindhoven Volley',
    'Drenthe Volleybal', 'Rotterdam Volley', 'Den Haag Volleybal', 'Limburg Lions',
];

const PORTUGAL_TEAMS = [
    'Benfica Lisbon', 'Sporting CP', 'FC Porto Volleyball', 'Castêlo da Maia',
    'Vitória SC Volleyball', 'Académica Coimbra', 'Esmoriz GC', 'Leixões SC',
    'SC Espinho', 'Sporting de Espinho', 'Fonte do Bastardo', 'Vôlei Clube Viana',
    'GD Sesimbra', 'Castelo Branco Volley', 'Madeira Volley', 'Algarve Volleyball',
];

const SPAIN_TEAMS = [
    'Unicaja Almería', 'CV Teruel', 'CV Melilla', 'CV Guaguas Las Palmas',
    'CV Pamesa Teruel', 'CV San Roque Batán', 'CV Soria', 'Río Duero Soria',
    'CV Manacor', 'CV Vall d\'Hebron', 'CV Mediterráneo Castellón', 'CV Sant Pere y Sant Pau',
    'CV Barcelona', 'CV Sevilla', 'CV Bilbao', 'CV Valencia',
];

// ---------------------------------------------------------------------------
// Countries master list
// ---------------------------------------------------------------------------

const COUNTRIES: CountryData[] = [
    {
        country: 'Slovenia',
        leagueName: 'Slovenian Volleyball League',
        teams: SLOVENIA_TEAMS,
        firstNames: SLOVENIAN_FIRST_NAMES,
        lastNames: SLOVENIAN_LAST_NAMES,
    },
    {
        country: 'Bulgaria',
        leagueName: 'Bulgarian Super Volley',
        teams: BULGARIA_TEAMS,
        firstNames: BULGARIAN_FIRST_NAMES,
        lastNames: BULGARIAN_LAST_NAMES,
    },
    {
        country: 'Germany',
        leagueName: 'Volleyball Bundesliga',
        teams: GERMANY_TEAMS,
        firstNames: GERMAN_FIRST_NAMES,
        lastNames: GERMAN_LAST_NAMES,
    },
    {
        country: 'Serbia',
        leagueName: 'Serbian Superliga Volleyball',
        teams: SERBIA_TEAMS,
        firstNames: SERBIAN_FIRST_NAMES,
        lastNames: SERBIAN_LAST_NAMES,
    },
    {
        country: 'Belgium',
        leagueName: 'Lotto Volley League',
        teams: BELGIUM_TEAMS,
        firstNames: BELGIAN_FIRST_NAMES,
        lastNames: BELGIAN_LAST_NAMES,
    },
    {
        country: 'Russia',
        leagueName: 'Russian Super League',
        teams: RUSSIA_TEAMS,
        firstNames: RUSSIAN_FIRST_NAMES,
        lastNames: RUSSIAN_LAST_NAMES,
    },
    {
        country: 'Ukraine',
        leagueName: 'Ukrainian Super League',
        teams: UKRAINE_TEAMS,
        firstNames: UKRAINIAN_FIRST_NAMES,
        lastNames: UKRAINIAN_LAST_NAMES,
    },
    {
        country: 'Czechia',
        leagueName: 'Czech Extraliga Volleyball',
        teams: CZECHIA_TEAMS,
        firstNames: CZECH_FIRST_NAMES,
        lastNames: CZECH_LAST_NAMES,
    },
    {
        country: 'Finland',
        leagueName: 'Mestaruusliiga',
        teams: FINLAND_TEAMS,
        firstNames: FINNISH_FIRST_NAMES,
        lastNames: FINNISH_LAST_NAMES,
    },
    {
        country: 'Netherlands',
        leagueName: 'Eredivisie Volleybal',
        teams: NETHERLANDS_TEAMS,
        firstNames: DUTCH_FIRST_NAMES,
        lastNames: DUTCH_LAST_NAMES,
    },
    {
        country: 'Portugal',
        leagueName: 'Portuguese Volleyball League A1',
        teams: PORTUGAL_TEAMS,
        firstNames: PORTUGUESE_FIRST_NAMES,
        lastNames: PORTUGUESE_LAST_NAMES,
    },
    {
        country: 'Spain',
        leagueName: 'Superliga Masculina',
        teams: SPAIN_TEAMS,
        firstNames: SPANISH_FIRST_NAMES,
        lastNames: SPANISH_LAST_NAMES,
    },
];

// ---------------------------------------------------------------------------
// Player generation (mirrors generatePolishPlayer)
// ---------------------------------------------------------------------------

function generatePlayer(teamId: number, jerseyNumber: number, position: string, country: CountryData) {
    const firstName = pick(country.firstNames);
    const lastName = pick(country.lastNames);
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
        country: country.country,
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
