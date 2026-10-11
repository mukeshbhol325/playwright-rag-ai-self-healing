import { TEXT } from '../../src/config/constants';
import { expect, test } from '../../src/fixtures/test';

test.describe('Storefront smoke', () => {
  test('home page loads @smoke', async ({ homePage }) => {
    await homePage.open();
    expect(await homePage.title()).toContain(TEXT.homeTitle);
  });

  test('top menu opens Phones & PDAs @smoke', async ({ homePage, smartphonePage }) => {
    await homePage.open();
    await homePage.openPhonesFromMenu();
    expect(homePage.url()).toContain('smartphone');
    expect(await smartphonePage.heading()).toContain('Phones');
  });

  test('search finds the iPhone @smoke', async ({ homePage }) => {
    await homePage.open();
    await homePage.searchFor('iPhone');
    expect(await homePage.searchResultNames()).toContain('iPhone');
  });
});
