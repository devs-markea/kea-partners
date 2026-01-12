import {getCollection} from "astro:content";

export async function getResourceMenu(lang: string) {
    const categories = await getCollection('categories');
    const articles = await getCollection('articles');

    const menu = categories
        .filter(c => c.data.lang === lang && !c.data.parent)
        .map(cat => {
            const subs = categories
                .filter(s => s.data.lang === lang && s.data.parent === cat.id)
                .map(sub => {
                    return {
                        ...sub.data,
                        articles: articles.filter(
                            a => a.data.subcategory === sub.data.title && a.data.lang === lang
                        )
                    };
                });
            return { ...cat.data, subcategories: subs };
        });

    return menu;
}
