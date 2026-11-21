import { describe, expect, it } from "vitest";
import {
  clearCreatorProjectContent,
  createCreatorProject,
  createLesson,
  findLessonForPart,
  groupLessonsByCollection,
  lessonTitleWithinCollection,
  markProjectLessonsFull,
  mergeProjectSegments,
  mergeSegments,
  normalizeCreatorProject,
  removeProjectCourse,
  removeProjectLessons,
  removeProjectSection,
  stampCreatorProject,
  updateProjectLesson,
} from "./creator";

describe("creator project helpers", () => {
  function projectWithHierarchy() {
    const project = createCreatorProject();
    const section = {
      id: "section-test",
      title: "测试章节",
      lessons: [] as ReturnType<typeof createLesson>[],
    };
    const course = {
      id: "course-test",
      title: "测试课程",
      description: "",
      cover: "",
      author: "",
      sections: [section],
    };
    project.courses.push(course);
    return { project, course, section };
  }

  it("creates a usable empty visual project", () => {
    const project = createCreatorProject();
    expect(project.courses).toHaveLength(0);
    expect(project.author).toBe("");
    expect(project.createdAt).toBe("");
  });

  it("normalizes imported parts and segments", () => {
    const project = normalizeCreatorProject({
      name: "英语课程",
      author: "学生编辑",
      createdAt: "2026-09-01T18:30:00.000Z",
      courses: [
        {
          title: "口语",
          sections: [
            {
              title: "第一单元",
              lessons: [
                {
                  title: "问候",
                  bvid: "BV1cTtr6oEZa",
                  cid: 42,
                  inclusion: "segments",
                  segments: [
                    { start: 30, end: 90, title: "表达" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const lesson = project.courses[0].sections[0].lessons[0];
    expect(project.author).toBe("学生编辑");
    expect(project.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(lesson.inclusion).toBe("segments");
    expect(lesson.cid).toBe(42);
    expect(lesson.segments[0].title).toBe("表达");
  });

  it("merges overlapping playback ranges", () => {
    expect(
      mergeSegments([
        { start: 10, end: 30, title: "A" },
        { start: 25, end: 45, title: "B" },
        { start: 80, end: 100, title: "C" },
      ]),
    ).toMatchObject([
      { start: 10, end: 45, title: "A、B" },
      { start: 80, end: 100, title: "C" },
    ]);
  });

  it("stamps the Bilibili account name and export time", () => {
    const project = createCreatorProject();
    const stamped = stampCreatorProject(
      project,
      "B站学习作者",
      new Date(2026, 10, 20, 16, 8),
    );

    expect(stamped.author).toBe("B站学习作者");
    expect(stamped.createdAt).toBe("2026-11-20T16:08");
  });

  it("updates lesson modes by part without touching other videos", () => {
    const { project, section } = projectWithHierarchy();
    section.lessons.push(
      createLesson({
        title: "P1",
        bvid: "BV1cTtr6oEZa",
        cid: 101,
        page: 1,
      }),
    );
    const lessonId = findLessonForPart(
      project,
      "BV1cTtr6oEZa",
      101,
    )?.lesson.id;
    expect(lessonId).toBeTruthy();

    const withSegments = mergeProjectSegments(
      project,
      new Set([lessonId!]),
      [{ start: 20, end: 50, title: "重点" }],
    );
    expect(findLessonForPart(withSegments, "BV1cTtr6oEZa", 101)?.lesson.inclusion)
      .toBe("segments");

    const fullAgain = markProjectLessonsFull(
      withSegments,
      new Set([lessonId!]),
    );
    expect(findLessonForPart(fullAgain, "BV1cTtr6oEZa", 101)?.lesson.segments)
      .toEqual([]);
  });

  it("updates editable metadata while retaining the list hierarchy", () => {
    const { project } = projectWithHierarchy();
    const lesson = createLesson({
      title: "课程视频",
      bvid: "BV1cTtr6oEZa",
      cid: 8,
    });
    project.courses[0].sections[0].lessons.push(lesson);
    const updated = updateProjectLesson(project, lesson.id, {
      title: "新的标题",
    });
    expect(updated.courses[0].sections[0].lessons[0].title).toBe("新的标题");
  });

  it("removes only the selected video from the list", () => {
    const { project, section } = projectWithHierarchy();
    const keep = createLesson({
      title: "保留",
      bvid: "BV1keep",
      cid: 1,
    });
    const remove = createLesson({
      title: "移除",
      bvid: "BV1remove",
      cid: 2,
    });
    section.lessons.push(keep, remove);

    const updated = removeProjectLessons(project, new Set([remove.id]));

    expect(updated.courses[0].sections[0].lessons).toEqual([keep]);
    expect(updated.courses[0].sections[0].lessons).toHaveLength(1);
  });

  it("groups videos from the same collection under one cover", () => {
    const first = createLesson({
      title: "MIT 线性代数 · 第一讲",
      bvid: "BV1first",
      collectionId: "season-1",
      collectionTitle: "MIT 线性代数",
      collectionCover: "collection-cover.jpg",
    });
    const second = createLesson({
      title: "MIT 线性代数 · 第二讲",
      bvid: "BV1second",
      collectionId: "season-1",
      collectionTitle: "MIT 线性代数",
      collectionCover: "collection-cover.jpg",
    });
    const standalone = createLesson({
      title: "独立视频",
      bvid: "BV1standalone",
    });

    const groups = groupLessonsByCollection([first, second, standalone]);

    expect(groups).toHaveLength(2);
    expect(groups[0].cover).toBe("collection-cover.jpg");
    expect(groups[0].lessons).toHaveLength(2);
    expect(lessonTitleWithinCollection(first, groups[0].title)).toBe(
      "第一讲",
    );
  });

  it("infers collections in existing saved lists from shared titles", () => {
    const first = createLesson({
      title: "英式英语合集 · 问候",
      bvid: "BV1first",
      cover: "shared-cover.jpg",
    });
    const second = createLesson({
      title: "英式英语合集 · 告别",
      bvid: "BV1second",
      cover: "shared-cover.jpg",
    });

    const groups = groupLessonsByCollection([first, second]);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("英式英语合集");
    expect(groups[0].cover).toBe("shared-cover.jpg");
  });

  it("removes a course or section together with its videos", () => {
    const { project, course, section } = projectWithHierarchy();
    section.lessons.push(
      createLesson({ title: "视频", bvid: "BV1lesson", cid: 1 }),
    );

    const withoutSection = removeProjectSection(
      project,
      course.id,
      section.id,
    );
    expect(withoutSection.courses[0].sections).toHaveLength(0);

    const withoutCourse = removeProjectCourse(project, course.id);
    expect(withoutCourse.courses).toHaveLength(0);
  });

  it("clears content while preserving list metadata", () => {
    const { project, section } = projectWithHierarchy();
    project.name = "保留名称";
    project.author = "作者";
    project.createdAt = "2026-11-20T10:30";
    section.lessons.push(
      createLesson({ title: "视频", bvid: "BV1clear", cid: 1 }),
    );

    const cleared = clearCreatorProjectContent(project);

    expect(cleared.name).toBe("保留名称");
    expect(cleared.author).toBe("作者");
    expect(cleared.createdAt).toBe("2026-11-20T10:30");
    expect(cleared.courses).toHaveLength(0);
  });
});
