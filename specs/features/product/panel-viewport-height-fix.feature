@product @panel-viewport-height-fix @layout @responsive @e2e
Feature: Panel viewport height fix

  The central work area and the right panel reach the same bottom boundary
  as the left region on desktop viewports, while the left footer and the
  mobile layout keep their current geometry.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active

  @product @layout @e2e @delta-added
  Scenario: Central area and right panel reach the viewport bottom on desktop
    Given the viewport is 1280 by 720 pixels on desktop
    When the user measures the region geometry
    Then the central area bottom edge equals the viewport bottom
    And the right panel bottom edge equals the viewport bottom
    And the right panel right edge aligns with the viewport right edge
    And the document does not scroll

  @product @layout @e2e @delta-added
  Scenario Outline: Regions reach the bottom at common desktop sizes
    Given the viewport is <width> by <height> pixels on desktop
    When the user measures the region geometry
    Then the central area bottom edge equals the viewport bottom
    And the right panel bottom edge equals the viewport bottom
    And the document does not scroll

    Examples:
      | width | height |
      | 1280  | 720    |
      | 1440  | 800    |

  @product @layout @e2e @delta-added
  Scenario: Collapsed right strip reaches the viewport bottom
    Given the viewport is 1280 by 720 pixels on desktop
    When the user collapses the right panel
    Then the right strip bottom edge equals the viewport bottom
    And the right strip keeps its rail width

  @product @layout @e2e @delta-added
  Scenario: Left footer stays bottom-most and keeps its widths
    Given the viewport is 1280 by 720 pixels on desktop
    When the user measures the left footer geometry
    Then the left footer bottom edge equals the viewport bottom
    And the left footer spans the left panel width when expanded
    When the user collapses the left panel
    Then the left footer spans only the rail width
    And the left footer stays bottom-most

  @product @responsive @e2e @delta-added
  Scenario Outline: Mobile layout still reaches the viewport bottom
    Given the viewport is <width> by <height> pixels on mobile
    When the user measures the mobile region geometry
    Then the central area reaches the viewport bottom
    And the rail and the right panel toggle reach the viewport bottom
    And the document does not scroll
    When the user opens the right panel sheet
    Then the sheet bottom is anchored to the viewport bottom

    Examples:
      | width | height |
      | 320   | 568    |
      | 375   | 667    |
      | 768   | 800    |