import NotImplementedException from './error/not-implemented-exception';
import System from './system';
import Versioning from './versioning';

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Versioning', () => {
  describe('strategies', () => {
    it('returns an object', () => {
      expect(typeof Versioning.strategies).toStrictEqual('object');
    });

    it('has items', () => {
      expect(Object.values(Versioning.strategies).length).toBeGreaterThan(2);
    });

    it('has an opt out option', () => {
      expect(Versioning.strategies).toHaveProperty('None');
    });

    it('has the semantic option', () => {
      expect(Versioning.strategies).toHaveProperty('Semantic');
    });

    it('has a strategy for tags', () => {
      expect(Versioning.strategies).toHaveProperty('Tag');
    });

    it('has an option that allows custom input', () => {
      expect(Versioning.strategies).toHaveProperty('Custom');
    });
  });

  describe('branch', () => {
    it('returns headRef when set', () => {
      const headReference = jest
        .spyOn(Versioning, 'headRef', 'get')
        .mockReturnValue('feature-branch-1');

      expect(Versioning.branch).toStrictEqual('feature-branch-1');
      expect(headReference).toHaveBeenCalledTimes(1);
    });

    it('returns part of Ref when set', () => {
      jest.spyOn(Versioning, 'headRef', 'get').mockReturnValue(undefined);
      const reference = jest
        .spyOn(Versioning, 'ref', 'get')
        .mockReturnValue('refs/heads/feature-branch-2');

      expect(Versioning.branch).toStrictEqual('feature-branch-2');
      expect(reference).toHaveBeenCalledTimes(2);
    });

    it('prefers headRef over ref when set', () => {
      const headReference = jest
        .spyOn(Versioning, 'headRef', 'get')
        .mockReturnValue('feature-branch-1');
      const reference = jest
        .spyOn(Versioning, 'ref', 'get')
        .mockReturnValue('refs/heads/feature-2');

      expect(Versioning.branch).toStrictEqual('feature-branch-1');
      expect(headReference).toHaveBeenCalledTimes(1);
      expect(reference).toHaveBeenCalledTimes(0);
    });

    it('returns undefined when headRef and ref are not set', () => {
      const headReference = jest.spyOn(Versioning, 'headRef', 'get').mockReturnValue(undefined);
      const reference = jest.spyOn(Versioning, 'ref', 'get').mockReturnValue(undefined);

      expect(Versioning.branch).not.toBeDefined();

      expect(headReference).toHaveBeenCalledTimes(1);
      expect(reference).toHaveBeenCalledTimes(1);
    });
  });

  describe('descriptionRegex', () => {
    it('is a valid regex', () => {
      expect(Versioning.descriptionRegex).toBeInstanceOf(RegExp);
    });

    test.each(['v1.1-1-g12345678', 'v0.1-2-g12345678', 'v0.0-500-gA9B6C3D0-dirty'])(
      'is happy with valid %s',
      description => {
        expect(Versioning.descriptionRegex.test(description)).toBeTruthy();
      },
    );

    test.each([null, undefined, 'v0', 'v0.1', 'v0.1.2', 'v0.1-2', 'v0.1-2-g'])(
      'does not like %s',
      description => {
        expect(Versioning.descriptionRegex.test(description)).toBeFalsy();
        // Also never expect without the v to work for any of these cases.
        expect(Versioning.descriptionRegex.test(description?.substr(1))).toBeFalsy();
      },
    );
  });

  describe('determineVersion', () => {
    test.each([null, undefined, 0, 'somethingRandom'])(
      'throws for invalid strategy %s',
      async strategy => {
        await expect(Versioning.determineVersion(strategy)).rejects.toThrowErrorMatchingSnapshot();
      },
    );

    describe('opt out strategy', () => {
      it("returns 'none'", async () => {
        await expect(Versioning.determineVersion('None', 'v1.0')).resolves.toMatchInlineSnapshot(
          `"none"`,
        );
      });
    });

    describe('custom strategy', () => {
      test.each([null, undefined, 0, 'v0.1', '1', 'CamelCase', 'dashed-version'])(
        'returns the inputVersion for %s',
        async inputVersion => {
          await expect(Versioning.determineVersion('Custom', inputVersion)).resolves.toStrictEqual(
            inputVersion,
          );
        },
      );
    });

    describe('semantic strategy', () => {
      it('refers to generateSemanticVersion', async () => {
        const generateSemanticVersion = jest
          .spyOn(Versioning, 'generateSemanticVersion')
          .mockResolvedValue('1.3.37');

        await expect(Versioning.determineVersion('Semantic')).resolves.toStrictEqual('1.3.37');
        expect(generateSemanticVersion).toHaveBeenCalledTimes(1);
      });
    });

    describe('tag strategy', () => {
      it('refers to generateTagVersion', async () => {
        const generateTagVersion = jest
          .spyOn(Versioning, 'generateTagVersion')
          .mockResolvedValue('0.1');

        await expect(Versioning.determineVersion('Tag')).resolves.toStrictEqual('0.1');
        expect(generateTagVersion).toHaveBeenCalledTimes(1);
      });
    });

    describe('not implemented strategy', () => {
      it('throws a not implemented exception', async () => {
        const strategy = 'Test';
        jest.spyOn(Versioning, 'strategies', 'get').mockReturnValue({ [strategy]: strategy });
        await expect(Versioning.determineVersion(strategy)).rejects.toThrowError(
          NotImplementedException,
        );
      });
    });
  });

  describe('generateTagVersion', () => {
    it('removes the v', async () => {
      jest.spyOn(Versioning, 'getTag').mockResolvedValue('v1.3.37');
      await expect(Versioning.generateTagVersion()).resolves.toStrictEqual('1.3.37');
    });
  });

  describe('parseSemanticVersion', () => {
    it('returns the named parts', async () => {
      jest.spyOn(Versioning, 'getVersionDescription').mockResolvedValue('v0.1-2-g12345678');

      await expect(Versioning.parseSemanticVersion()).resolves.toMatchObject({
        tag: '0.1',
        commits: '2',
        hash: '12345678',
      });
    });

    it('throws when no match could be made', async () => {
      jest.spyOn(Versioning, 'getVersionDescription').mockResolvedValue('no-match-can-be-made');

      await expect(Versioning.parseSemanticVersion()).rejects.toThrowErrorMatchingInlineSnapshot(
        `"Failed to parse git describe output: \\"no-match-can-be-made\\"."`,
      );
    });
  });

  describe('getVersionDescription', () => {
    it('returns the commands output', async () => {
      const runOutput = 'someValue';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.getVersionDescription()).resolves.toStrictEqual(runOutput);
    });
  });

  describe('fetchAll', () => {
    it('awaits the command', async () => {
      jest.spyOn(System, 'run').mockResolvedValue(null);
      await expect(Versioning.fetchAll()).resolves.not.toThrow();
    });
  });

  describe('isDirty', () => {
    it('returns true when there are files listed', async () => {
      const runOutput = 'file.ext\nfile2.ext';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.isDirty()).resolves.toStrictEqual(true);
    });

    it('returns false when there is no output', async () => {
      const runOutput = '';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.isDirty()).resolves.toStrictEqual(false);
    });
  });

  describe('getTag', () => {
    it('returns the commands output', async () => {
      const runOutput = 'v1.0';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.getTag()).resolves.toStrictEqual(runOutput);
    });
  });

  describe('hasAnyVersionTags', () => {
    it('returns false when the command returns 0', async () => {
      const runOutput = '0';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.hasAnyVersionTags()).resolves.toStrictEqual(false);
    });

    it('returns true when the command returns >= 0', async () => {
      const runOutput = '9';
      jest.spyOn(System, 'run').mockResolvedValue(runOutput);
      await expect(Versioning.hasAnyVersionTags()).resolves.toStrictEqual(true);
    });
  });

  describe('getTotalNumberOfCommits', () => {
    it('returns a number from the command', async () => {
      jest.spyOn(System, 'run').mockResolvedValue('9');
      await expect(Versioning.getTotalNumberOfCommits()).resolves.toStrictEqual(9);
    });
  });
});
