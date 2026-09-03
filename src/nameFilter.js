import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";
import { getSettings } from "./settings.js";

const PLACEHOLDER_NAME = "Hidden Name";

let matcher = null;

function getMatcher() {
    if (matcher === null) matcher = new RegExpMatcher({
        ...englishDataset.build(),
        ...englishRecommendedTransformers
    });
    return matcher;
}

function isInappropriate(name) {
    return getMatcher().hasMatch(name);
}

function filter(name) {
    if (typeof name !== "string" || !getSettings().hideInappropriateNames) return name;
    return isInappropriate(name) ? PLACEHOLDER_NAME : name;
}

export default { filter, isInappropriate };
