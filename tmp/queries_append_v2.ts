
export function getCupFixtureById(fixtureId: number): CupGame | undefined {
  const CUP_FIXTURE_JOIN_INNER = `
    SELECT cf.*,
      ht.team_name AS home_team_name,
      at.team_name AS away_team_name,
      cc.name AS cup_name
    FROM cup_fixtures cf
    JOIN teams ht ON cf.home_team_id = ht.id
    JOIN teams at ON cf.away_team_id = at.id
    JOIN cup_competitions cc ON cf.cup_id = cc.id
  `;
  return getDb().prepare(`
    \${CUP_FIXTURE_JOIN_INNER}
    WHERE cf.id = ?
  `).get(fixtureId) as CupGame | undefined;
}
