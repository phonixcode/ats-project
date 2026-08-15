import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let dir: string;
  let previousDataDir: string | undefined;
  let previousOpenAi: string | undefined;
  let service: SettingsService;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mg-ats-settings-'));
    previousDataDir = process.env.MG_ATS_DATA_DIR;
    previousOpenAi = process.env.OPENAI_API_KEY;
    process.env.MG_ATS_DATA_DIR = dir;
    delete process.env.OPENAI_API_KEY;
    delete process.env.CLAUDE_API_KEY;
    delete process.env.GEMINI_API_KEY;
    service = new SettingsService(new SettingsRepository());
  });

  afterEach(() => {
    if (previousDataDir === undefined) delete process.env.MG_ATS_DATA_DIR;
    else process.env.MG_ATS_DATA_DIR = previousDataDir;
    if (previousOpenAi === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAi;
    rmSync(dir, { recursive: true, force: true });
  });

  it('uses a saved key and hides it behind a hint', () => {
    const snapshot = service.update({
      reader: 'openai',
      openaiApiKey: 'sk-test-secret-1234',
    });
    expect(snapshot.openai.configured).toBe(true);
    expect(snapshot.openai.hint).toBe('••••1234');
    expect(snapshot.using).toBe('openai');
    expect(service.cloudKey('openai')).toBe('sk-test-secret-1234');
    expect(readFileSync(join(dir, 'settings.json'), 'utf8')).not.toContain(
      'hint',
    );
  });

  it('uses the reader they pick, not the first saved key', () => {
    service.update({ reader: 'openai', openaiApiKey: 'sk-openai-0001' });
    const snapshot = service.update({ reader: 'claude', claudeApiKey: 'sk-claude-0002' });
    expect(snapshot.using).toBe('claude');
    expect(snapshot.openai.configured).toBe(true);
  });

  it('falls back to env when nothing is saved', () => {
    process.env.CLAUDE_API_KEY = 'claude-env-key-99';
    expect(service.cloudKey('claude')).toBe('claude-env-key-99');
    expect(service.snapshot().using).toBe('claude');
  });

  it('clears a saved key', () => {
    service.update({ reader: 'openai', openaiApiKey: 'sk-keep-me-0001' });
    const snapshot = service.update({ reader: 'builtin', openaiApiKey: '' });
    expect(snapshot.openai.configured).toBe(false);
    expect(snapshot.using).toBe('builtin');
    expect(service.cloudKey('openai')).toBeNull();
  });
});
