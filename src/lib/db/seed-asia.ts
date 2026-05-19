import Database from 'better-sqlite3';
import type { LeagueConfig } from '../league-engine';
import { calculateOverall } from '../overall';

/**
 * Idempotent Asian leagues seeder.
 *
 * Inserts EIGHT Asian countries (Japan, China, South Korea, Philippines,
 * Vietnam, Thailand, Taiwan, Iran) at once. Each country gets a single
 * tier-2 league using the single_table format, with 16 teams and 7 players
 * per team. Each league runs Jan–Apr with a top-8 playoff bracket (Quarter
 * Finals, Semi Finals, Grand Final).
 *
 * No promotion/relegation chains (no league_links). A single shared
 * league_presets row ('Asian Single-Tier Standard') is inserted once.
 *
 * Skips entirely if Japan is already present in the database.
 */
export function seedAsia(db: Database.Database): void {
    const existing = db.prepare(
        "SELECT COUNT(*) as c FROM leagues WHERE country = 'Japan'"
    ).get() as { c: number };
    if (existing.c > 0) return;

    const run = db.transaction(() => {
        const sharedConfig: LeagueConfig = {
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

        const insertLeague = db.prepare(
            "INSERT INTO leagues (league_name, country, tier, continent) VALUES (?, ?, 2, 'Asia')"
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

        for (const c of COUNTRIES) {
            const leagueId = Number(insertLeague.run(c.leagueName, c.country).lastInsertRowid);
            insertCfg.run(leagueId, JSON.stringify(sharedConfig));

            const teamIds: number[] = [];
            for (const teamName of c.teams) {
                const money = randInt(10_000_000, 18_500_000);
                teamIds.push(Number(insertTeam.run(teamName, leagueId, c.country, money).lastInsertRowid));
            }

            for (const teamId of teamIds) {
                const usedJerseys = new Set<number>();
                for (let p = 0; p < 7; p++) {
                    let jersey: number;
                    do { jersey = randInt(1, 99); } while (usedJerseys.has(jersey));
                    usedJerseys.add(jersey);
                    insertPlayer.run(generateAsianPlayer(teamId, jersey, positionOrder[p], c.country, c.firstNames, c.lastNames));
                }
            }
        }

        const insertPreset = db.prepare(
            "INSERT OR IGNORE INTO league_presets (preset_name, config) VALUES (?, ?)"
        );
        insertPreset.run('Asian Single-Tier Standard', JSON.stringify(sharedConfig));
    });
    run();
}

// -----------------------------------------------------------------------------
// Per-country data
// -----------------------------------------------------------------------------

interface CountryData {
    country: string;
    leagueName: string;
    teams: string[];
    firstNames: string[];
    lastNames: string[];
}

const JAPAN_FIRST_NAMES = [
    'Hiroshi', 'Takeshi', 'Kenji', 'Yuki', 'Daichi', 'Sho', 'Ren', 'Haruto',
    'Riku', 'Sota', 'Yuto', 'Kaito', 'Tatsuya', 'Ryota', 'Kenta', 'Naoki',
    'Akira', 'Tomoya', 'Shinji', 'Masato', 'Kazuki', 'Yamato', 'Hayato', 'Daiki',
    'Ryo', 'Taiga', 'Itsuki', 'Souta', 'Yusuke', 'Takumi', 'Keisuke', 'Junpei',
    'Shogo', 'Tsubasa', 'Hideo', 'Kenshiro',
];

const JAPAN_LAST_NAMES = [
    'Tanaka', 'Suzuki', 'Sato', 'Takahashi', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura',
    'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue',
    'Kimura', 'Hayashi', 'Shimizu', 'Saito', 'Hashimoto', 'Mori', 'Ikeda', 'Hashimoto',
    'Abe', 'Ishikawa', 'Yamazaki', 'Maeda', 'Fujita', 'Ogawa', 'Goto', 'Okada',
    'Hasegawa', 'Murakami', 'Kondo', 'Ishii',
];

const CHINA_FIRST_NAMES = [
    'Wei', 'Jie', 'Hao', 'Lei', 'Tao', 'Ming', 'Qiang', 'Bin',
    'Yong', 'Gang', 'Jun', 'Bo', 'Long', 'Feng', 'Xiang', 'Peng',
    'Hui', 'Liang', 'Yang', 'Chao', 'Kai', 'Jian', 'Chen', 'Zhi',
    'Heng', 'Xin', 'Yu', 'Yi', 'Da', 'Sheng', 'Hong', 'Cheng',
    'Han', 'Lin', 'Rui', 'Tian',
];

const CHINA_LAST_NAMES = [
    'Wang', 'Li', 'Zhang', 'Liu', 'Chen', 'Yang', 'Zhao', 'Huang',
    'Zhou', 'Wu', 'Xu', 'Sun', 'Hu', 'Zhu', 'Gao', 'Lin',
    'He', 'Guo', 'Ma', 'Luo', 'Liang', 'Song', 'Zheng', 'Xie',
    'Han', 'Tang', 'Feng', 'Yu', 'Dong', 'Xiao', 'Cheng', 'Cao',
    'Yuan', 'Deng', 'Xu', 'Fu',
];

const KOREA_FIRST_NAMES = [
    'Min-jun', 'Seo-jun', 'Ji-ho', 'Joon-ho', 'Hyun-woo', 'Do-yoon', 'Jun-seo', 'Si-woo',
    'Ye-jun', 'Yu-jun', 'Tae-min', 'Sung-min', 'Jae-hyun', 'Min-seok', 'Dong-hyun', 'Jin-woo',
    'Sang-hoon', 'Ji-hoon', 'Hyun-jin', 'Seung-hyun', 'Tae-yang', 'Ho-jun', 'Jung-woo', 'Kang-min',
    'Woo-jin', 'Han-seo', 'Yun-ho', 'Eun-woo', 'Joon-young', 'Sung-jin', 'Min-ho', 'Tae-hyun',
    'Hae-jin', 'Byung-chul', 'Chang-min', 'Gun-woo',
];

const KOREA_LAST_NAMES = [
    'Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon',
    'Jang', 'Lim', 'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang',
    'Ahn', 'Song', 'Yoo', 'Hong', 'Jeon', 'Go', 'Moon', 'Yang',
    'Son', 'Bae', 'Baek', 'Heo', 'Nam', 'Ryu', 'Jin', 'Min',
    'Roh', 'Pyo', 'Joo', 'Ha',
];

const PHILIPPINES_FIRST_NAMES = [
    'Jose', 'Juan', 'Carlo', 'Marco', 'Mark', 'John', 'Paolo', 'Miguel',
    'Rafael', 'Andres', 'Antonio', 'Manuel', 'Joshua', 'Christian', 'Jericho', 'Bryan',
    'Kevin', 'Daniel', 'Ramon', 'Eduardo', 'Francisco', 'Gabriel', 'Joaquin', 'Renato',
    'Rodrigo', 'Santiago', 'Vicente', 'Diego', 'Emilio', 'Ferdinand', 'Lorenzo', 'Mateo',
    'Nicolas', 'Patricio', 'Rommel', 'Sebastian',
];

const PHILIPPINES_LAST_NAMES = [
    'Santos', 'Reyes', 'Cruz', 'Bautista', 'Garcia', 'Mendoza', 'Torres', 'Tomas',
    'Andrada', 'Castillo', 'Villanueva', 'Ramos', 'Domingo', 'Aquino', 'Aguilar', 'Salonga',
    'Fernandez', 'Manalo', 'Pascual', 'Diaz', 'Valdez', 'Cabrera', 'Soriano', 'Navarro',
    'Lopez', 'De Leon', 'Tolentino', 'Espiritu', 'Romero', 'Marquez', 'Flores', 'Gonzales',
    'Hernandez', 'Lim', 'Maglinte', 'Ocampo',
];

const VIETNAM_FIRST_NAMES = [
    'Van An', 'Van Hung', 'Van Minh', 'Van Nam', 'Van Duc', 'Van Long', 'Van Phong', 'Van Quan',
    'Van Son', 'Van Thanh', 'Van Toan', 'Van Trung', 'Van Tu', 'Van Vinh', 'Hoang Anh', 'Hoang Long',
    'Quoc Bao', 'Quoc Khanh', 'Quoc Tuan', 'Tuan Anh', 'Tuan Dung', 'Tuan Hai', 'Minh Tuan', 'Minh Khang',
    'Duc Anh', 'Duc Huy', 'Hai Dang', 'Hai Phong', 'Cong Phuong', 'Cong Vinh', 'Xuan Truong', 'Xuan Hung',
    'Thanh Tung', 'Thai Son', 'Trong Hoang', 'Anh Tuan',
];

const VIETNAM_LAST_NAMES = [
    'Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Phan', 'Vu', 'Vo',
    'Dang', 'Bui', 'Do', 'Ho', 'Ngo', 'Duong', 'Ly', 'Trinh',
    'Dinh', 'Truong', 'Lam', 'Doan', 'Mai', 'Cao', 'Ha', 'Thach',
    'Luu', 'Ta', 'Quach', 'Chu', 'Trieu', 'Khong', 'Tong', 'Kieu',
    'Lai', 'Vuong', 'To', 'Hua',
];

const THAILAND_FIRST_NAMES = [
    'Somchai', 'Somsak', 'Anan', 'Anuwat', 'Chaiwat', 'Kittipong', 'Narongsak', 'Niran',
    'Pichai', 'Prasert', 'Pongsak', 'Sakda', 'Suchart', 'Sumet', 'Surasak', 'Thaksin',
    'Thanawat', 'Theerathon', 'Wichai', 'Wirat', 'Boonchai', 'Chanin', 'Decha', 'Ekkarat',
    'Jakkrit', 'Kawin', 'Komkrit', 'Lertchai', 'Manat', 'Nattawut', 'Pakorn', 'Pratheep',
    'Rangsan', 'Sarawut', 'Teerasak', 'Wattana',
];

const THAILAND_LAST_NAMES = [
    'Suwannakit', 'Saetang', 'Charoenphan', 'Phromchai', 'Boonyasak', 'Wongthong', 'Srisuwan', 'Thanasak',
    'Phongpheng', 'Inthawong', 'Chotirat', 'Klinsukon', 'Sangsuk', 'Tantivejakul', 'Kosolkitiwong', 'Wanmali',
    'Rattanachai', 'Thongdee', 'Phuwanart', 'Sanitwong', 'Anantasin', 'Sripradit', 'Boonmee', 'Mekkarin',
    'Chaisawat', 'Tantipanichkul', 'Ngarmpring', 'Wattanasin', 'Phonprapha', 'Charoensuk', 'Nontasin', 'Saengthong',
    'Phakdee', 'Vongthong', 'Riensawat', 'Suksai',
];

const TAIWAN_FIRST_NAMES = [
    'Chih-hung', 'Chia-hao', 'Chien-ming', 'Cheng-wei', 'Chun-hsien', 'Hung-wei', 'Jia-chen', 'Kuan-yu',
    'Ming-che', 'Po-jen', 'Shih-hao', 'Ting-wei', 'Tsung-han', 'Wei-cheng', 'Yi-cheng', 'Yu-hsiang',
    'Cheng-en', 'Hao-ran', 'Jui-en', 'Kai-wen', 'Lung-fei', 'Meng-hsuan', 'Nai-hao', 'Pin-hung',
    'Sheng-hao', 'Tai-yuan', 'Wei-ting', 'Yen-shou', 'Zhi-yang', 'Chao-hsiang', 'De-hua', 'Fang-yu',
    'Guan-ting', 'Hsiu-wen', 'Jen-hao', 'Kuo-wei',
];

const TAIWAN_LAST_NAMES = [
    'Chen', 'Lin', 'Huang', 'Chang', 'Lee', 'Wu', 'Liu', 'Tsai',
    'Yang', 'Chen', 'Hsu', 'Cheng', 'Hsieh', 'Kuo', 'Tseng', 'Lu',
    'Chou', 'Yeh', 'Su', 'Chiang', 'Lai', 'Lo', 'Hung', 'Hsu',
    'Pan', 'Chiu', 'Tang', 'Han', 'Wen', 'Pai', 'Fang', 'Tu',
    'Chiu', 'Chien', 'Ho', 'Lan',
];

const IRAN_FIRST_NAMES = [
    'Ali', 'Mohammad', 'Hossein', 'Hassan', 'Reza', 'Mehdi', 'Amir', 'Saeed',
    'Mostafa', 'Saman', 'Farhad', 'Behnam', 'Arash', 'Kamran', 'Pouya', 'Milad',
    'Navid', 'Omid', 'Payam', 'Ramin', 'Shahab', 'Siavash', 'Vahid', 'Yaser',
    'Babak', 'Bardia', 'Ehsan', 'Iman', 'Kaveh', 'Kourosh', 'Masoud', 'Mojtaba',
    'Nima', 'Peyman', 'Sajjad', 'Soheil',
];

const IRAN_LAST_NAMES = [
    'Mousavi', 'Ghaemi', 'Marouf', 'Ebadipour', 'Abedini', 'Sharifi', 'Manavinejad', 'Esfandiar',
    'Faezi', 'Saber Kazemi', 'Karimi', 'Mahmoudi', 'Salehi', 'Rezaei', 'Hosseini', 'Ahmadi',
    'Jafari', 'Tavakoli', 'Asgari', 'Sadeghi', 'Akbari', 'Rahmani', 'Naderi', 'Heydari',
    'Ranjbar', 'Zarei', 'Shojaei', 'Mokhtari', 'Bagheri', 'Najafi', 'Tabatabai', 'Daneshvar',
    'Farzan', 'Ghasemi', 'Khalili', 'Lotfi',
];

const COUNTRIES: CountryData[] = [
    {
        country: 'Japan',
        leagueName: 'V.League Division 1',
        teams: [
            'JTEKT Stings',
            'Suntory Sunbirds',
            'Panasonic Panthers',
            'Toray Arrows',
            'Wolfdogs Nagoya',
            'JT Thunders Hiroshima',
            'Sakai Blazers',
            'Tokyo Great Bears',
            'Oita Miyoshi Weisse Adler',
            'VC Nagano Tridents',
            'Osaka Blazers',
            'FC Tokyo Volleyball',
            'Kurobe AquaFairies Men',
            'Saitama Ageo Medics',
            'Yokohama Sea Spiders',
            'Kobe Falcons',
        ],
        firstNames: JAPAN_FIRST_NAMES,
        lastNames: JAPAN_LAST_NAMES,
    },
    {
        country: 'China',
        leagueName: 'Chinese Volleyball Super League',
        teams: [
            'Shanghai Golden Age',
            'Beijing BAIC Motor',
            'Jiangsu Zenith Steel',
            'Sichuan Volleyball Club',
            'Shandong Rizhao',
            'Henan Volleyball Club',
            'Zhejiang Volleyball',
            'Guangdong Evergrande',
            'Liaoning Panpan',
            'Fujian Anxi Tieguanyin',
            'Tianjin Bohai Bank',
            'Hubei Volleyball Club',
            'Hebei Volleyball Club',
            'Yunnan Volleyball',
            'Shenzhen Coastal',
            'Chongqing Volleyball Club',
        ],
        firstNames: CHINA_FIRST_NAMES,
        lastNames: CHINA_LAST_NAMES,
    },
    {
        country: 'South Korea',
        leagueName: 'V-League Korea',
        teams: [
            'Korean Air Jumbos',
            'Samsung Bluefangs',
            'Hyundai Capital Skywalkers',
            'KB Insurance Stars',
            'OK Financial Group Okman',
            'Woori Card Wibee',
            'Seoul Insurance Eagles',
            'Daejeon Star Wings',
            'Busan Harbor Hawks',
            'Incheon Sky Riders',
            'Suwon Tigers',
            'Gwangju Phoenix',
            'Ulsan Steelers',
            'Pohang Coastliners',
            'Daegu Lightning',
            'Jeju Wave Riders',
        ],
        firstNames: KOREA_FIRST_NAMES,
        lastNames: KOREA_LAST_NAMES,
    },
    {
        country: 'Philippines',
        leagueName: 'Premier Volleyball League',
        teams: [
            'Cignal HD Spikers',
            'Manila Boltz',
            'Cebu Sharks',
            'Davao Eagles',
            'Quezon City Capitals',
            'Makati Diamonds',
            'Iloilo Voyagers',
            'Bacolod Smashers',
            'Baguio Highlanders',
            'Tagaytay Riders',
            'Zamboanga Marauders',
            'Pasig Crocodiles',
            'Cagayan de Oro Storm',
            'Tacloban Typhoons',
            'Laguna Heroes',
            'Bataan Risers',
        ],
        firstNames: PHILIPPINES_FIRST_NAMES,
        lastNames: PHILIPPINES_LAST_NAMES,
    },
    {
        country: 'Vietnam',
        leagueName: 'Vietnamese Volleyball League',
        teams: [
            'Sanest Khanh Hoa',
            'Trang An Ninh Binh',
            'Bien Phong',
            'Vietinbank Hanoi',
            'Maseco TPHCM',
            'Tu Long Thai Binh',
            'Hai Duong Volleyball Club',
            'Quan Doan 4',
            'Long An Volleyball',
            'Ho Chi Minh City Sailors',
            'Da Nang Coast',
            'Hue Imperial',
            'Hai Phong Port',
            'Can Tho Mekong',
            'Quang Ninh Miners',
            'Vinh Phuc Volleyball',
        ],
        firstNames: VIETNAM_FIRST_NAMES,
        lastNames: VIETNAM_LAST_NAMES,
    },
    {
        country: 'Thailand',
        leagueName: 'Thailand League',
        teams: [
            'Nakhon Ratchasima QminC',
            'Diamond Food Saraburi',
            'Sisaket Volleyball Club',
            'Khon Kaen Star',
            'Supreme Chonburi',
            'Bangkok Glass',
            'Air Force Volleyball Club',
            'Rangsit University',
            'Pattaya Sharks',
            'Phuket Sea Lions',
            'Chiang Mai Northern Stars',
            'Hat Yai Spikers',
            'Udon Thani Smashers',
            'Surat Thani Coastliners',
            'Ayutthaya Heritage',
            'Songkhla Tigers',
        ],
        firstNames: THAILAND_FIRST_NAMES,
        lastNames: THAILAND_LAST_NAMES,
    },
    {
        country: 'Taiwan',
        leagueName: 'Top Volleyball League',
        teams: [
            'Taipei Mizuno',
            'Taoyuan Conti',
            'Taichung Bank',
            'Kaohsiung Eagles',
            'Hsinchu Tech Stars',
            'Tainan Heritage',
            'Keelung Harbor',
            'Chiayi Phoenix',
            'Pingtung Tropics',
            'Hualien Pacific',
            'Yilan Coastal',
            'Miaoli Mountain',
            'Nantou Highlands',
            'Changhua Volleyball Club',
            'Yunlin Spikers',
            'New Taipei Tigers',
        ],
        firstNames: TAIWAN_FIRST_NAMES,
        lastNames: TAIWAN_LAST_NAMES,
    },
    {
        country: 'Iran',
        leagueName: 'Iranian Volleyball Super League',
        teams: [
            'Paykan Tehran',
            'Saipa Tehran',
            'Shahrdari Tabriz',
            'Sarmayeh Bank Tehran',
            'Foolad Sirjan Iranian',
            'Khatam Ardakan',
            'Shahrdari Urmia',
            'Saman Bank Tehran',
            'Pegah Esfahan',
            'Aluminium Arak',
            'Shahrdari Gonbad',
            'Mes Rafsanjan',
            'Bank Melli Tehran',
            'Petroshimi Bandar Imam',
            'Damash Gilan',
            'Naft Mahmoudabad',
        ],
        firstNames: IRAN_FIRST_NAMES,
        lastNames: IRAN_LAST_NAMES,
    },
];

const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite Hitter', 'Libero'];

function generateAsianPlayer(
    teamId: number,
    jerseyNumber: number,
    position: string,
    country: string,
    firstNames: string[],
    lastNames: string[],
) {
    const firstName = pick(firstNames);
    const lastName = pick(lastNames);
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
        country,
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
