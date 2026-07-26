import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { scanSkills, skillId } from '../src/main/skills/scan.js'

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'tasker-scan-'))
  const alpha = join(root, 'alpha')
  await mkdir(alpha, { recursive: true })
  await writeFile(
    join(alpha, 'SKILL.md'),
    '---\nname: Alpha Skill\ndescription: Reads rows.\ntags: [a, b]\n---\n# Alpha\n',
    'utf8'
  )
  await writeFile(join(alpha, 'preview.gif'), 'GIF89a', 'utf8')

  const nested = join(root, 'group', 'beta')
  await mkdir(nested, { recursive: true })
  await writeFile(join(nested, 'SKILL.md'), '---\nname: Beta Skill\n---\n', 'utf8')

  const ignored = join(root, 'node_modules', 'gamma')
  await mkdir(ignored, { recursive: true })
  await writeFile(join(ignored, 'SKILL.md'), '---\nname: Gamma\n---\n', 'utf8')

  return root
}

test('finds skills in nested folders', async () => {
  const root = await fixture()
  try {
    const skills = await scanSkills([root])
    assert.deepEqual(
      skills.map((skill) => skill.name),
      ['Alpha Skill', 'Beta Skill']
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('reads the preview file', async () => {
  const root = await fixture()
  try {
    const skills = await scanSkills([root])
    const alpha = skills[0]
    assert.ok(alpha)
    assert.equal(alpha.preview.kind, 'gif')
    assert.match(alpha.preview.url ?? '', /^tasker-asset:\/\//)
    assert.deepEqual(alpha.tags, ['a', 'b'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('uses the folder name when the frontmatter has no name', async () => {
  const root = await mkdtemp(join(tmpdir(), 'tasker-scan-'))
  try {
    const dir = join(root, 'plain-skill')
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, 'SKILL.md'), '# No frontmatter\n', 'utf8')
    const skills = await scanSkills([root])
    assert.equal(skills[0]?.name, 'plain-skill')
    assert.equal(skills[0]?.preview.kind, 'none')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('accepts a root that does not exist', async () => {
  const skills = await scanSkills([join(tmpdir(), 'tasker-missing-root-xyz')])
  assert.deepEqual(skills, [])
})

test('the identifier is stable', () => {
  assert.equal(skillId('/a/b'), skillId('/a/b'))
  assert.notEqual(skillId('/a/b'), skillId('/a/c'))
})
